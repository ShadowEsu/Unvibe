import { getBillingStore } from '@/billing/store';
import { getStore } from '@/data/store';
import {
  GIFT_LIMIT,
  GIFT_MONTHS,
  giftCodeFromEmail,
  giftCodeMatchesEmail,
  isGiftSubscriptionId,
  isVerifiableGiftCode,
  normalizeEmail,
  normalizeGiftCode,
} from './codes';
import { getGiftLedger } from './ledger';

export interface GiftClaimInput {
  recipientEmail: string;
  giverEmail: string;
  promoCode: string;
}

export type GiftClaimResult =
  | { ok: true; used: number; granted: boolean }
  | { ok: false; error: string; message: string };

function addMonths(iso: string | undefined, months: number, now = new Date()): string {
  const start = iso ? new Date(iso) : now;
  const base = Number.isNaN(start.getTime()) || start < now ? now : start;
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, base.getUTCDate(), base.getUTCHours(), base.getUTCMinutes(), base.getUTCSeconds())).toISOString();
}

export async function grantComplimentaryMonths(userId: string, months: number): Promise<void> {
  if (months <= 0) return;
  const billing = getBillingStore();
  const workspace = await billing.ensurePersonalWorkspace(userId);
  const overview = await billing.overview(userId, workspace.id);
  const current = overview.subscription;
  if (current.stripeSubscriptionId && !isGiftSubscriptionId(current.stripeSubscriptionId) && current.status !== 'canceled' && current.plan !== 'free') {
    return;
  }
  const periodEnd = addMonths(current.currentPeriodEnd, months);
  const periodStart = current.currentPeriodStart ?? new Date().toISOString();
  const giftId = `gift:${workspace.id}`;
  await billing.syncSubscription({
    workspaceId: workspace.id,
    plan: 'pro',
    interval: 'monthly',
    status: 'trialing',
    seats: 1,
    stripeCustomerId: current.stripeCustomerId && !isGiftSubscriptionId(current.stripeCustomerId) ? current.stripeCustomerId : giftId,
    stripeSubscriptionId: giftId,
    stripePriceId: giftId,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
  });
}

async function grantToEmail(email: string): Promise<boolean> {
  const userId = await getStore().findUserIdByEmail(email);
  if (userId) {
    await grantComplimentaryMonths(userId, GIFT_MONTHS);
    return true;
  }
  await getGiftLedger().addPendingMonths(email, GIFT_MONTHS);
  return false;
}

export async function applyPendingGiftMonths(userId: string, email?: string): Promise<void> {
  if (!email) return;
  const months = await getGiftLedger().takePendingMonths(email);
  if (months > 0) await grantComplimentaryMonths(userId, months);
}

export async function giftProgress(code: string): Promise<{ found: boolean; used: number; limit: number }> {
  const normalized = normalizeGiftCode(code);
  if (!isVerifiableGiftCode(normalized)) return { found: false, used: 0, limit: GIFT_LIMIT };
  const used = Math.min(GIFT_LIMIT, await getGiftLedger().countForCode(normalized));
  return { found: true, used, limit: GIFT_LIMIT };
}

export async function claimGift(input: GiftClaimInput): Promise<GiftClaimResult> {
  const recipientEmail = normalizeEmail(input.recipientEmail);
  const giverEmail = normalizeEmail(input.giverEmail);
  const promoCode = normalizeGiftCode(input.promoCode);
  if (!recipientEmail.includes('@') || !giverEmail.includes('@')) {
    return { ok: false, error: 'invalid_email', message: 'Friend email and your email are both required.' };
  }
  if (recipientEmail === giverEmail) {
    return { ok: false, error: 'self_gift', message: 'A gift has to go to someone else.' };
  }
  if (!giftCodeMatchesEmail(giverEmail, promoCode)) {
    return { ok: false, error: 'unknown_code', message: 'That SPECIAL CHAR does not match the friend email. Ask them to copy the code from Gift Unvibe.' };
  }
  const ledger = getGiftLedger();
  if (await ledger.alreadyRedeemed(promoCode, recipientEmail)) {
    const used = Math.min(GIFT_LIMIT, await ledger.countForCode(promoCode));
    return { ok: true, used, granted: false };
  }
  const used = await ledger.countForCode(promoCode);
  if (used >= GIFT_LIMIT) {
    return { ok: false, error: 'gift_cap', message: 'This code has already given five months of Pro.' };
  }
  await ledger.addRedemption({
    giverEmail,
    giverCode: promoCode,
    recipientEmail,
    months: GIFT_MONTHS,
  });
  await grantToEmail(giverEmail);
  await grantToEmail(recipientEmail);
  return { ok: true, used: used + 1, granted: true };
}

export function expectedGiftCode(email: string): string {
  return giftCodeFromEmail(email);
}
