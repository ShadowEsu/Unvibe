import Stripe from 'stripe';
import type { BillingInterval, PlanId } from './types';

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY on the server.');
  stripeClient ??= new Stripe(key, { apiVersion: '2026-06-24.dahlia', typescript: true });
  return stripeClient;
}

export function stripePriceId(plan: Exclude<PlanId, 'free'>, interval: BillingInterval): string {
  if (interval === 'lifetime') {
    if (plan !== 'pro') throw new Error('Lifetime checkout is only configured for Pro.');
    const value = process.env.STRIPE_PRICE_PRO_LIFETIME?.trim();
    if (!value) throw new Error('STRIPE_PRICE_PRO_LIFETIME is not configured.');
    return value;
  }
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is not configured.`);
  return value;
}

/** Pro monthly + annual checkout can go live without Lifetime configured. */
export function stripeIsConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim() &&
      process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_PRO_ANNUAL?.trim(),
  );
}

/**
 * Live money stays off until Preston approves it: a live (or restricted live) secret key
 * alone never opens checkout. Set BILLING_LIVE_PAYMENTS_APPROVED=true only after that approval.
 * Test-mode keys are never locked, so sandbox checkout keeps working.
 */
export function livePaymentsLocked(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || key.startsWith('sk_test_') || key.startsWith('rk_test_')) return false;
  return process.env.BILLING_LIVE_PAYMENTS_APPROVED?.trim() !== 'true';
}

export const PAYMENTS_NOT_OPEN = {
  error: 'payments_not_open',
  message: 'Payments open soon. Your Free plan keeps working until then.',
} as const;

/** Monthly and annual checkout: configured, and not a locked live account. */
export function checkoutOpen(): boolean {
  return stripeIsConfigured() && !livePaymentsLocked();
}

/** Pro Lifetime is hidden unless explicitly enabled (pending Preston's keep/drop decision). */
export function lifetimeCheckoutOpen(): boolean {
  return checkoutOpen() && Boolean(process.env.STRIPE_PRICE_PRO_LIFETIME?.trim()) && process.env.BILLING_LIFETIME_ENABLED?.trim() === 'true';
}

export function publicAppUrl(req: Request): string {
  // APP_URL is deliberately server-only. The old PUBLIC_APP_URL name is kept
  // as a migration fallback for existing deployments.
  const configured = process.env.APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') throw new Error('APP_URL is required in production.');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
