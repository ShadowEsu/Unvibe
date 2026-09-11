import { createHash, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getStore } from '@/data/store';
import { getBillingStore } from './store';

export const MAX_GIFTS = 5;
export const GIFT_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface GiftClaim {
  id: string;
  giverEmail: string;
  receiverEmail: string;
  promoCode: string;
  createdAt: string;
}

export interface GiftProgress {
  found: boolean;
  code: string;
  joined: number;
  used: number;
  remaining: number;
  max: number;
  limit: number;
  shareUrl: string;
}

interface GiftMemory {
  claims: GiftClaim[];
}

function memory(): GiftMemory {
  const g = globalThis as unknown as { __unvibeGiftClaims?: GiftMemory };
  g.__unvibeGiftClaims ??= { claims: [] };
  return g.__unvibeGiftClaims;
}

function supabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Same 8-character code the waitlist uses: first 8 hex chars of sha256(email). */
export function specialCharForEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex').slice(0, 8);
}

export function waitlistOrigin(): string {
  return (process.env.WAITLIST_PUBLIC_URL?.trim() || 'https://unvibe.site').replace(/\/$/, '');
}

export function giftShareUrl(code: string, giverEmail?: string): string {
  const base = `${waitlistOrigin()}/?ref=${encodeURIComponent(code)}`;
  if (!giverEmail) return base;
  return `${base}&from=${encodeURIComponent(normalizeEmail(giverEmail))}`;
}

async function listClaims(): Promise<GiftClaim[]> {
  const db = supabase();
  if (!db) return memory().claims;
  const { data, error } = await db.from('gift_claims').select('id,giver_email,receiver_email,promo_code,created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    giverEmail: String(row.giver_email),
    receiverEmail: String(row.receiver_email),
    promoCode: String(row.promo_code),
    createdAt: String(row.created_at),
  }));
}

async function insertClaim(claim: GiftClaim): Promise<void> {
  const db = supabase();
  if (!db) {
    memory().claims.push(claim);
    return;
  }
  const { error } = await db.from('gift_claims').insert({
    id: claim.id,
    giver_email: claim.giverEmail,
    receiver_email: claim.receiverEmail,
    promo_code: claim.promoCode,
    created_at: claim.createdAt,
  });
  if (error) {
    if (error.code === '23505') throw new Error('This gift was already claimed.');
    throw new Error(error.message);
  }
}

async function grantIfAccount(email: string, endsAt: string): Promise<boolean> {
  const userId = await getStore().userIdForEmail(email);
  if (!userId) return false;
  const result = await getBillingStore().grantGiftMonth(userId, endsAt);
  return result.applied;
}

export async function giftProgressForCode(code: string, giverEmail?: string): Promise<GiftProgress> {
  const normalized = code.trim().toLowerCase();
  const claims = await listClaims();
  const joined = claims.filter((claim) => claim.promoCode === normalized).length;
  return {
    found: joined > 0 || normalized.length === 8,
    code: normalized,
    joined,
    used: joined,
    remaining: Math.max(0, MAX_GIFTS - joined),
    max: MAX_GIFTS,
    limit: MAX_GIFTS,
    shareUrl: giftShareUrl(normalized, giverEmail),
  };
}

export async function giftProgressForEmail(email: string): Promise<GiftProgress> {
  return giftProgressForCode(specialCharForEmail(email), email);
}

export async function applyGiftsForEmail(email: string, now = new Date()): Promise<number> {
  const normalized = normalizeEmail(email);
  const claims = await listClaims();
  let applied = 0;
  for (const claim of claims) {
    if (claim.giverEmail !== normalized && claim.receiverEmail !== normalized) continue;
    const endsAt = new Date(new Date(claim.createdAt).getTime() + GIFT_MONTH_MS);
    if (endsAt <= now) continue;
    if (await grantIfAccount(normalized, endsAt.toISOString())) applied += 1;
  }
  return applied;
}

export async function claimGift(input: {
  giverEmail?: unknown;
  receiverEmail?: unknown;
  recipientEmail?: unknown;
  promoCode?: unknown;
}, now = new Date()): Promise<{ ok: true; progress: GiftProgress; granted: { giver: boolean; receiver: boolean } }> {
  const giverEmail = typeof input.giverEmail === 'string' ? normalizeEmail(input.giverEmail) : '';
  const receiverRaw = typeof input.receiverEmail === 'string' ? input.receiverEmail
    : typeof input.recipientEmail === 'string' ? input.recipientEmail
    : '';
  const receiverEmail = normalizeEmail(receiverRaw);
  const promoCode = typeof input.promoCode === 'string' ? input.promoCode.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(giverEmail) || !EMAIL_RE.test(receiverEmail)) {
    throw new Error('Friend email and your email are both required.');
  }
  if (giverEmail === receiverEmail) throw new Error('You cannot gift Unvibe to the same email.');
  if (promoCode !== specialCharForEmail(giverEmail)) {
    throw new Error('That SPECIAL CHAR does not match the friend email. Ask them to copy the code from Gift Unvibe.');
  }
  const claims = await listClaims();
  if (claims.some((claim) => claim.giverEmail === giverEmail && claim.receiverEmail === receiverEmail)) {
    throw new Error('This gift was already claimed.');
  }
  const used = claims.filter((claim) => claim.giverEmail === giverEmail).length;
  if (used >= MAX_GIFTS) throw new Error('This giver has already used all five gifts.');
  const claim: GiftClaim = {
    id: randomUUID(),
    giverEmail,
    receiverEmail,
    promoCode,
    createdAt: now.toISOString(),
  };
  await insertClaim(claim);
  const endsAt = new Date(now.getTime() + GIFT_MONTH_MS).toISOString();
  const giver = await grantIfAccount(giverEmail, endsAt);
  const receiver = await grantIfAccount(receiverEmail, endsAt);
  return { ok: true, progress: await giftProgressForCode(promoCode), granted: { giver, receiver } };
}
