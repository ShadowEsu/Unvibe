import type { SupabaseClient } from '@supabase/supabase-js';
import { getStore } from '@/data/store';
import { serviceSupabase } from '@/lib/serviceSupabase';
import { MemoryBillingStore } from './memoryBillingStore';

/**
 * Promo codes (spec agents/unvibe/2026-10-25-promo-codes-spec.md): single-use codes that add
 * complimentary Pro months through add_pro_months. In production the SQL functions
 * redeem_promo_code and revoke_promo_code (migration 20261026090000_promo_codes.sql) do the work
 * atomically; the memory backend below mirrors them, check for check, for dev and tests.
 *
 * There is no minting here on purpose: batches and code hashes are inserted by a one-off SQL file
 * (scripts/promo-batch.mjs), so the admin token can list and revoke but never create Pro.
 */

export type PromoRedeemStatus =
  | 'redeemed'
  | 'already_yours'
  | 'invalid'
  | 'expired'
  | 'used'
  | 'one_per_account'
  | 'cap_reached'
  | 'has_paid_plan';

const REDEEM_STATUSES: readonly PromoRedeemStatus[] = [
  'redeemed', 'already_yours', 'invalid', 'expired', 'used', 'one_per_account', 'cap_reached', 'has_paid_plan',
];

export interface PromoRedeemResult {
  status: PromoRedeemStatus;
  months: number | null;
  proUntil: string | null;
}

export type PromoRevokeStatus = 'revoked' | 'already_revoked' | 'not_found';

export interface PromoRevokeResult {
  status: PromoRevokeStatus;
  /** True when the redemption was reversed (its months came off any running complimentary Pro). */
  monthsTakenBack: boolean;
  proUntil: string | null;
}

export interface PromoBatchSummary {
  id: string;
  label: string;
  months: number;
  redeemBy: string;
  maxRedemptions: number;
  revokedAt: string | null;
  codes: number;
  /** Redemptions not revoked. */
  redeemed: number;
  /** Redemptions revoked by an admin (their months were taken back). */
  redemptionsRevoked: number;
  /** Codes revoked by an admin. */
  revoked: number;
  capLeft: number;
}

export interface PromoRedemptionSummary {
  batchId: string;
  /** First 8 hex characters of the code hash: enough to tell rows apart, useless for redeeming. */
  codeHashPrefix: string;
  email: string | null;
  months: number;
  redeemedAt: string;
  revokedAt: string | null;
  /** The Pro end date this redemption set. */
  proUntil: string;
}

export interface PromoAdminList {
  batches: PromoBatchSummary[];
  redemptions: PromoRedemptionSummary[];
}

export interface VerifiedAccount {
  id: string;
  email: string | null;
}

export interface PromoBackend {
  /** The account behind a Supabase access token, or null when the token is not valid. */
  verifyAccessToken(accessToken: string): Promise<VerifiedAccount | null>;
  /** users(id, email), the way device approval upserts it. */
  upsertUser(account: VerifiedAccount): Promise<void>;
  redeem(userId: string, codeHash: string): Promise<PromoRedeemResult>;
  list(): Promise<PromoAdminList>;
  revokeCode(codeHash: string): Promise<PromoRevokeResult>;
  revokeBatch(batchId: string): Promise<PromoRevokeStatus>;
}

/** Storage is not configured (production without Supabase): routes answer 503. */
export class PromoUnavailableError extends Error {
  constructor() {
    super('Promo codes are not available right now.');
  }
}

export const BATCH_ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

// ------------------------------------------------------------------ memory backend (dev, tests)

interface MemoryBatch {
  id: string;
  label: string;
  months: number;
  redeemBy: string;
  maxRedemptions: number;
  revokedAt: string | null;
}

interface MemoryRedemption {
  codeHash: string;
  batchId: string;
  userId: string;
  email: string | null;
  months: number;
  /** What the grant added to the Pro end date, after the 12-month ceiling (SQL `granted`). */
  grantedMs: number;
  periodEndAfter: string;
  redeemedAt: string;
  revokedAt: string | null;
}

interface PromoMemory {
  batches: Map<string, MemoryBatch>;
  codes: Map<string, { batchId: string; revokedAt: string | null }>;
  redemptions: Map<string, MemoryRedemption>;
  lock: Promise<unknown>;
}

function memory(): PromoMemory {
  const g = globalThis as unknown as { __unvibePromo?: PromoMemory };
  g.__unvibePromo ??= { batches: new Map(), codes: new Map(), redemptions: new Map(), lock: Promise.resolve() };
  return g.__unvibePromo;
}

/** Dev and test only: what the hash-only SQL insert does in production. */
export function seedMemoryPromoBatch(
  batch: { id: string; label?: string; months: number; redeemBy: string; maxRedemptions: number; revokedAt?: string | null },
  codeHashes: string[],
): void {
  const data = memory();
  data.batches.set(batch.id, { label: batch.id, revokedAt: null, ...batch });
  for (const codeHash of codeHashes) data.codes.set(codeHash, { batchId: batch.id, revokedAt: null });
}

/** Serialises memory operations the way the batch row lock serialises them in SQL. */
function locked<T>(work: () => Promise<T>): Promise<T> {
  const data = memory();
  const run = data.lock.then(work);
  data.lock = run.catch(() => undefined);
  return run;
}

const none = (status: PromoRedeemStatus): PromoRedeemResult => ({ status, months: null, proUntil: null });

const memoryBackend: PromoBackend = {
  async verifyAccessToken(accessToken) {
    const userId = await getStore().userForToken(accessToken);
    if (!userId) return null;
    return { id: userId, email: (await getStore().accountInfo(userId)).email ?? null };
  },
  async upsertUser() {
    // Memory accounts exist as soon as their session does.
  },
  redeem(userId, codeHash) {
    return locked(async () => {
      const data = memory();
      const code = data.codes.get(codeHash);
      const batch = code ? data.batches.get(code.batchId) : undefined;
      if (!code || !batch || code.revokedAt || batch.revokedAt) return none('invalid');
      const prior = data.redemptions.get(codeHash);
      if (prior) {
        if (prior.userId !== userId || prior.revokedAt) return none('used');
        const overview = await new MemoryBillingStore().overview(userId);
        const end = overview.subscription.currentPeriodEnd;
        const running = overview.subscription.plan === 'pro' && overview.subscription.status === 'trialing' && end && new Date(end) > new Date();
        return { status: 'already_yours', months: prior.months, proUntil: running ? end : prior.periodEndAfter };
      }
      if (Date.now() > new Date(batch.redeemBy).getTime()) return none('expired');
      const rows = [...data.redemptions.values()].filter((row) => row.batchId === batch.id);
      if (rows.some((row) => row.userId === userId)) return none('one_per_account');
      if (rows.filter((row) => !row.revokedAt).length >= batch.maxRedemptions) return none('cap_reached');
      const billing = new MemoryBillingStore();
      const before = (await billing.overview(userId)).subscription;
      const now = Date.now();
      const runningEnd = before.currentPeriodEnd ? new Date(before.currentPeriodEnd).getTime() : 0;
      const from = before.plan === 'pro' && before.status === 'trialing' && runningEnd > now ? runningEnd : now;
      if (!(await billing.addProMonths(userId, batch.months)).applied) return none('has_paid_plan');
      const proUntil = (await billing.overview(userId)).subscription.currentPeriodEnd ?? new Date(now).toISOString();
      data.redemptions.set(codeHash, {
        codeHash, batchId: batch.id, userId, email: (await getStore().accountInfo(userId)).email ?? null, months: batch.months,
        grantedMs: Math.max(0, new Date(proUntil).getTime() - from), periodEndAfter: proUntil, redeemedAt: new Date().toISOString(), revokedAt: null,
      });
      return { status: 'redeemed', months: batch.months, proUntil };
    });
  },
  async list() {
    const data = memory();
    const redemptions = [...data.redemptions.values()];
    const codes = [...data.codes.values()];
    return {
      batches: [...data.batches.values()].map((batch) => {
        const mine = redemptions.filter((row) => row.batchId === batch.id);
        const live = mine.filter((row) => !row.revokedAt).length;
        return {
          ...batch,
          codes: codes.filter((code) => code.batchId === batch.id).length,
          redeemed: live,
          redemptionsRevoked: mine.length - live,
          revoked: codes.filter((code) => code.batchId === batch.id && code.revokedAt).length,
          capLeft: Math.max(0, batch.maxRedemptions - live),
        };
      }),
      redemptions: redemptions
        .sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt))
        .map((row) => ({
          batchId: row.batchId, codeHashPrefix: row.codeHash.slice(0, 8), email: row.email, months: row.months,
          redeemedAt: row.redeemedAt, revokedAt: row.revokedAt, proUntil: row.periodEndAfter,
        })),
    };
  },
  revokeCode(codeHash) {
    return locked(async (): Promise<PromoRevokeResult> => {
      const data = memory();
      const code = data.codes.get(codeHash);
      if (!code) return { status: 'not_found', monthsTakenBack: false, proUntil: null };
      const status = code.revokedAt ? 'already_revoked' : 'revoked';
      code.revokedAt ??= new Date().toISOString();
      const redemption = data.redemptions.get(codeHash);
      if (!redemption || redemption.revokedAt) return { status, monthsTakenBack: false, proUntil: null };
      const taken = await new MemoryBillingStore().takeBackProTime(redemption.userId, redemption.grantedMs);
      if (taken.paidUntouched) return { status, monthsTakenBack: false, proUntil: null };
      redemption.revokedAt = new Date().toISOString();
      return { status, monthsTakenBack: true, proUntil: taken.proUntil };
    });
  },
  revokeBatch(batchId) {
    return locked(async (): Promise<PromoRevokeStatus> => {
      const batch = memory().batches.get(batchId);
      if (!batch) return 'not_found';
      if (batch.revokedAt) return 'already_revoked';
      batch.revokedAt = new Date().toISOString();
      return 'revoked';
    });
  },
};

// ------------------------------------------------------------------ Supabase backend

/** PostgREST caps responses (1000 rows by default), so the redemption list is paged. */
const PAGE_SIZE = 1000;

interface BatchRow {
  id: string;
  label: string;
  months: number;
  redeem_by: string;
  max_redemptions: number;
  revoked_at: string | null;
}

interface RedemptionRow {
  code_hash: string;
  batch_id: string;
  email: string | null;
  months: number;
  redeemed_at: string;
  revoked_at: string | null;
  period_end_after: string;
}

function isRedeemStatus(value: unknown): value is PromoRedeemStatus {
  return typeof value === 'string' && (REDEEM_STATUSES as readonly string[]).includes(value);
}

/** `returns table` functions come back from PostgREST as an array, even for one row. */
function firstRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
}

function supabaseBackend(db: SupabaseClient): PromoBackend {
  async function count(table: 'promo_codes' | 'promo_redemptions', batchId: string, revoked: boolean | null): Promise<number> {
    let query = db.from(table).select('code_hash', { count: 'exact', head: true }).eq('batch_id', batchId);
    if (revoked === true) query = query.not('revoked_at', 'is', null);
    if (revoked === false) query = query.is('revoked_at', null);
    const { count: n, error } = await query;
    if (error) throw new Error(`${table} count failed: ${error.message}`);
    return n ?? 0;
  }

  return {
    async verifyAccessToken(accessToken) {
      // Same check as POST /api/v1/auth/approve: Supabase Auth resolves the access token.
      const { data, error } = await db.auth.getUser(accessToken);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null };
    },
    async upsertUser(account) {
      // Device approval: insert (id, email); on conflict keep the stored email unless a new one is given.
      const { error } = account.email
        ? await db.from('users').upsert({ id: account.id, email: account.email }, { onConflict: 'id' })
        : await db.from('users').upsert({ id: account.id }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error(`Could not save the account: ${error.message}`);
    },
    async redeem(userId, codeHash) {
      const { data, error } = await db.rpc('redeem_promo_code', { p_user_id: userId, p_code_hash: codeHash });
      if (error) throw new Error(`Could not redeem promo code: ${error.message}`);
      const row = firstRow(data);
      if (!isRedeemStatus(row.status)) throw new Error(`Unexpected promo redemption result: ${String(row.status)}`);
      return {
        status: row.status,
        months: typeof row.months === 'number' ? row.months : null,
        proUntil: typeof row.pro_until === 'string' ? row.pro_until : null,
      };
    },
    async list() {
      const { data: batchRows, error } = await db
        .from('promo_batches')
        .select('id, label, months, redeem_by, max_redemptions, revoked_at')
        .order('created_at');
      if (error) throw new Error(`promo_batches query failed: ${error.message}`);
      const batches = await Promise.all(((batchRows ?? []) as BatchRow[]).map(async (batch) => {
        const [codes, revoked, redeemed, redemptionsRevoked] = await Promise.all([
          count('promo_codes', batch.id, null),
          count('promo_codes', batch.id, true),
          count('promo_redemptions', batch.id, false),
          count('promo_redemptions', batch.id, true),
        ]);
        return {
          id: batch.id, label: batch.label, months: batch.months, redeemBy: batch.redeem_by,
          maxRedemptions: batch.max_redemptions, revokedAt: batch.revoked_at,
          codes, redeemed, redemptionsRevoked, revoked, capLeft: Math.max(0, batch.max_redemptions - redeemed),
        };
      }));
      const rows: RedemptionRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data: page, error: pageError } = await db
          .from('promo_redemptions')
          .select('code_hash, batch_id, email, months, redeemed_at, revoked_at, period_end_after')
          .order('redeemed_at', { ascending: false })
          .order('code_hash')
          .range(from, from + PAGE_SIZE - 1);
        if (pageError) throw new Error(`promo_redemptions query failed: ${pageError.message}`);
        rows.push(...((page ?? []) as RedemptionRow[]));
        if ((page ?? []).length < PAGE_SIZE) break;
      }
      return {
        batches,
        redemptions: rows.map((row) => ({
          batchId: row.batch_id, codeHashPrefix: row.code_hash.slice(0, 8), email: row.email, months: row.months,
          redeemedAt: row.redeemed_at, revokedAt: row.revoked_at, proUntil: row.period_end_after,
        })),
      };
    },
    async revokeCode(codeHash) {
      const { data, error } = await db.rpc('revoke_promo_code', { p_code_hash: codeHash });
      if (error) throw new Error(`Could not revoke promo code: ${error.message}`);
      const row = firstRow(data);
      if (row.status !== 'revoked' && row.status !== 'already_revoked' && row.status !== 'not_found') {
        throw new Error(`Unexpected promo revoke result: ${String(row.status)}`);
      }
      return {
        status: row.status,
        monthsTakenBack: row.months_taken_back === true,
        proUntil: typeof row.pro_until === 'string' ? row.pro_until : null,
      };
    },
    async revokeBatch(batchId) {
      const { data, error } = await db
        .from('promo_batches')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', batchId)
        .is('revoked_at', null)
        .select('id');
      if (error) throw new Error(`Could not revoke promo batch: ${error.message}`);
      if ((data ?? []).length > 0) return 'revoked';
      const { data: existing, error: lookupError } = await db.from('promo_batches').select('id').eq('id', batchId).maybeSingle();
      if (lookupError) throw new Error(`promo_batches lookup failed: ${lookupError.message}`);
      return existing ? 'already_revoked' : 'not_found';
    },
  };
}

/** Supabase when configured; memory in dev and tests; never memory in production. */
export function promoBackend(env: NodeJS.ProcessEnv = process.env): PromoBackend {
  const db = serviceSupabase();
  if (db) return supabaseBackend(db);
  if (env.NODE_ENV === 'production' && env.UNCODE_ALLOW_MEMORY_STORE !== 'true') throw new PromoUnavailableError();
  return memoryBackend;
}

/** HTTP status and message for each redemption result (spec "API"). */
export const PROMO_RESPONSES: Record<PromoRedeemStatus | 'bad_code', { http: number; message: string }> = {
  redeemed: { http: 200, message: 'Pro months added.' },
  already_yours: { http: 200, message: 'You already redeemed this code.' },
  bad_code: { http: 400, message: 'That code does not look right. Codes have 16 letters and numbers.' },
  invalid: { http: 404, message: 'That code was not found.' },
  used: { http: 409, message: 'That code has already been used.' },
  one_per_account: { http: 409, message: 'This account already used a code from this offer.' },
  has_paid_plan: { http: 409, message: 'You already have a paid plan, so the code was not used.' },
  expired: { http: 410, message: 'That code has expired.' },
  cap_reached: { http: 410, message: 'Every code from this offer has been claimed.' },
};
