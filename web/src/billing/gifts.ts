import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getStore } from '@/data/store';
import { MemoryBillingStore } from './memoryBillingStore';

/**
 * Gift months: a signed-in friend enters a giver's code and both accounts get a month of Pro.
 *
 * - The code is HMAC-SHA256(GIFT_CODE_SECRET, giver email), so only the server can issue it.
 *   It is issued (and registered against the giver's account) when the giver opens their
 *   Share page in the app. Without the secret, gifts are off.
 * - The receiver is always the signed-in caller. Both sides are existing accounts.
 * - One gift received per account, five friends per giver, months stack up to 12 ahead,
 *   and an active paid subscription is never changed. In production the SQL `claim_gift`
 *   enforces this atomically; the memory backend below mirrors it for dev and tests.
 */

export const MAX_GIFTS = 5;
export const GIFT_CODE_LENGTH = 16;
const MIN_SECRET_LENGTH = 32;
const CODE_RE = /^[A-Za-z0-9_-]{16}$/;

export type GiftErrorCode =
  | 'gifts_disabled'
  | 'email_required'
  | 'invalid_code'
  | 'unknown_code'
  | 'self_gift'
  | 'already_received'
  | 'giver_full';

const GIFT_ERRORS: Record<GiftErrorCode, { status: number; message: string }> = {
  gifts_disabled: { status: 503, message: 'Gifts are not available right now.' },
  email_required: { status: 400, message: 'Sign in with an email to use gifts.' },
  invalid_code: { status: 400, message: 'That gift code does not look right. Copy it again from your friend.' },
  unknown_code: { status: 400, message: 'That gift code was not found. Ask your friend to copy it again from Unvibe.' },
  self_gift: { status: 400, message: 'You cannot use your own gift code.' },
  already_received: { status: 409, message: 'This account already received a gift.' },
  giver_full: { status: 409, message: 'Your friend has already shared all five gifts.' },
};

export class GiftError extends Error {
  readonly status: number;

  constructor(readonly code: GiftErrorCode) {
    super(GIFT_ERRORS[code].message);
    this.status = GIFT_ERRORS[code].status;
  }
}

export interface GiftProgress {
  code: string;
  joined: number;
  used: number;
  remaining: number;
  max: number;
  limit: number;
  shareUrl: string;
}

type ClaimOutcome =
  | { status: 'ok'; giverApplied: boolean; receiverApplied: boolean }
  | { status: Exclude<GiftErrorCode, 'gifts_disabled' | 'invalid_code'> };

interface GiftBackend {
  registerCode(userId: string, code: string): Promise<void>;
  codeOwner(code: string): Promise<string | null>;
  giftsGiven(giverEmail: string): Promise<number>;
  claim(giverUserId: string, receiverUserId: string, code: string): Promise<ClaimOutcome>;
}

/** Gifts stay off (503) unless GIFT_CODE_SECRET is set and long enough to be a real secret. */
function requireSecret(): string {
  const secret = process.env.GIFT_CODE_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) throw new GiftError('gifts_disabled');
  return secret;
}

export function giftCodeForEmail(email: string, secret: string): string {
  return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('base64url').slice(0, GIFT_CODE_LENGTH);
}

async function accountEmail(userId: string): Promise<string> {
  return ((await getStore().accountInfo(userId)).email ?? '').trim().toLowerCase();
}

interface GiftRedemption {
  id: string;
  giverUserId: string | null;
  receiverUserId: string | null;
  giverEmail: string;
  receiverEmail: string;
  code: string;
  createdAt: string;
}

interface GiftMemory {
  codes: Map<string, string>;
  redemptions: GiftRedemption[];
  lock: Promise<unknown>;
}

function memory(): GiftMemory {
  const g = globalThis as unknown as { __unvibeGifts?: GiftMemory };
  g.__unvibeGifts ??= { codes: new Map(), redemptions: [], lock: Promise.resolve() };
  return g.__unvibeGifts;
}

/** Dev and test mirror of the SQL `claim_gift`; same checks in the same order. */
const memoryBackend: GiftBackend = {
  async registerCode(userId, code) {
    const codes = memory().codes;
    for (const [existing, owner] of codes) if (owner === userId) codes.delete(existing);
    codes.set(code, userId);
  },
  async codeOwner(code) {
    return memory().codes.get(code) ?? null;
  },
  async giftsGiven(giverEmail) {
    return memory().redemptions.filter((row) => row.giverEmail === giverEmail).length;
  },
  async claim(giverUserId, receiverUserId, code) {
    const data = memory();
    const run = data.lock.then(async (): Promise<ClaimOutcome> => {
      const receiver = await accountEmail(receiverUserId);
      if (!receiver) return { status: 'email_required' };
      const giver = data.codes.get(code) === giverUserId ? await accountEmail(giverUserId) : '';
      if (!giver) return { status: 'unknown_code' };
      if (giverUserId === receiverUserId || giver === receiver) return { status: 'self_gift' };
      if (data.redemptions.some((row) => row.receiverEmail === receiver)) return { status: 'already_received' };
      if (data.redemptions.filter((row) => row.giverEmail === giver).length >= MAX_GIFTS) return { status: 'giver_full' };
      const billing = new MemoryBillingStore();
      const applied = new Map<string, boolean>();
      for (const userId of [giverUserId, receiverUserId].sort()) applied.set(userId, (await billing.addProMonths(userId, 1)).applied);
      data.redemptions.push({
        id: randomUUID(), giverUserId, receiverUserId, giverEmail: giver, receiverEmail: receiver, code,
        createdAt: new Date().toISOString(),
      });
      return { status: 'ok', giverApplied: applied.get(giverUserId) === true, receiverApplied: applied.get(receiverUserId) === true };
    });
    data.lock = run.catch(() => undefined);
    return run;
  },
};

function supabaseBackend(db: SupabaseClient): GiftBackend {
  return {
    async registerCode(userId, code) {
      const { error } = await db.from('gift_codes').upsert({ user_id: userId, code }, { onConflict: 'user_id' });
      if (error) throw new Error(`Could not save gift code: ${error.message}`);
    },
    async codeOwner(code) {
      const { data, error } = await db.from('gift_codes').select('user_id').eq('code', code).maybeSingle();
      if (error) throw new Error(`Could not look up gift code: ${error.message}`);
      return typeof data?.user_id === 'string' ? data.user_id : null;
    },
    async giftsGiven(giverEmail) {
      const { count, error } = await db.from('gift_redemptions').select('id', { count: 'exact', head: true }).eq('giver_email', giverEmail);
      if (error) throw new Error(`Could not count gifts: ${error.message}`);
      return count ?? 0;
    },
    async claim(giverUserId, receiverUserId, code) {
      const { data, error } = await db.rpc('claim_gift', { p_giver_id: giverUserId, p_receiver_id: receiverUserId, p_code: code });
      if (error) throw new Error(`Could not claim gift: ${error.message}`);
      const row = (data ?? {}) as { status?: string; giver_applied?: boolean; receiver_applied?: boolean };
      if (row.status === 'ok') return { status: 'ok', giverApplied: row.giver_applied === true, receiverApplied: row.receiver_applied === true };
      if (row.status === 'email_required' || row.status === 'unknown_code' || row.status === 'self_gift'
        || row.status === 'already_received' || row.status === 'giver_full') {
        return { status: row.status };
      }
      throw new Error(`Unexpected gift claim result: ${String(row.status)}`);
    },
  };
}

function giftBackend(): GiftBackend {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return memoryBackend;
  return supabaseBackend(createClient(url, key, { auth: { persistSession: false } }));
}

/** The signed-in giver's code, share link and count. Issuing the code registers it. */
export async function giftProgressForUser(userId: string): Promise<GiftProgress> {
  const secret = requireSecret();
  const email = await accountEmail(userId);
  if (!email) throw new GiftError('email_required');
  const code = giftCodeForEmail(email, secret);
  const backend = giftBackend();
  await backend.registerCode(userId, code);
  const used = Math.min(MAX_GIFTS, await backend.giftsGiven(email));
  return {
    code,
    joined: used,
    used,
    remaining: MAX_GIFTS - used,
    max: MAX_GIFTS,
    limit: MAX_GIFTS,
    shareUrl: `${(process.env.WAITLIST_PUBLIC_URL?.trim() || 'https://unvibe.site').replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`,
  };
}

/**
 * The signed-in receiver redeems a giver's code. The code alone identifies the giver; any
 * email in the request is ignored. Returns whether the receiver's month was added (false
 * when the receiver has an active paid subscription, which a gift never changes).
 */
export async function claimGift(receiverUserId: string, rawCode: unknown): Promise<{ monthAdded: boolean }> {
  const secret = requireSecret();
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!CODE_RE.test(code)) throw new GiftError('invalid_code');
  const backend = giftBackend();
  const giverUserId = await backend.codeOwner(code);
  const giverEmail = giverUserId ? await accountEmail(giverUserId) : '';
  // Both sides are exactly GIFT_CODE_LENGTH ASCII characters here, so the buffers match in length.
  const genuine = giverEmail !== ''
    && timingSafeEqual(Buffer.from(code), Buffer.from(giftCodeForEmail(giverEmail, secret)));
  if (!giverUserId || !genuine) throw new GiftError('unknown_code');
  const outcome = await backend.claim(giverUserId, receiverUserId, code);
  if (outcome.status !== 'ok') throw new GiftError(outcome.status);
  return { monthAdded: outcome.receiverApplied };
}
