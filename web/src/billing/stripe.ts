import Stripe from 'stripe';
import { stripeKeyMode } from './stripeKey';
import { newTiersEnabled, PLAN_NAMES, planSoldOnInterval, type NewTierPlan } from './plans';
import type { BillingInterval, PlanId } from './types';

let stripeClient: Stripe | undefined;

/**
 * The Stripe client, only for a well-formed secret or restricted key (`stripeKeyMode`): any other
 * value throws before a client exists, so nothing is sent with it. It does not check the payment
 * lock: cancellations, refunds and account deletion keep serving existing customers while purchases
 * are locked, and each purchase path checks the lock itself.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key === undefined || stripeKeyMode(key) === null) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY on the server to a secret or restricted key.');
  stripeClient ??= new Stripe(key, { apiVersion: '2026-06-24.dahlia', typescript: true });
  return stripeClient;
}

/**
 * The configured Stripe price for a plan and interval: `STRIPE_PRICE_${PLAN}_${INTERVAL}`
 * (STRIPE_PRICE_PRO_LIFETIME, STRIPE_PRICE_ENTERPRISE_MONTHLY, STRIPE_PRICE_BUSINESS_LIFETIME, ...).
 * A plan never sold on that interval throws, whatever the environment holds.
 */
export function stripePriceId(plan: Exclude<PlanId, 'free'>, interval: BillingInterval): string {
  if (!planSoldOnInterval(plan, interval)) throw new Error(`${PLAN_NAMES[plan]} has no ${interval} price.`);
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is not configured.`);
  return value;
}

/** Pro monthly + annual checkout can go live without Lifetime configured. */
export function stripeIsConfigured(): boolean {
  return Boolean(
    stripeKeyMode(process.env.STRIPE_SECRET_KEY) !== null &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim() &&
      process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_PRO_ANNUAL?.trim(),
  );
}

/**
 * Checkout stays closed until Preston opens it:
 * - a live (or restricted live) key opens checkout only on the production deployment, and only with
 *   BILLING_LIVE_PAYMENTS_APPROVED set to exactly `true` (no trimming, so a stray " true " stays shut);
 *   a preview or a local server with a live key is always closed;
 * - a test key on the production deployment is closed too (it would grant real Pro for card 4242
 *   and refuse every real card) unless BILLING_TEST_CHECKOUT_IN_PRODUCTION is exactly `true` (no trimming).
 * Test keys on previews and local servers stay open, so sandbox checkout keeps working. A key that is
 * set but not a well-formed secret or restricted key (`stripeKeyMode` is null) is always locked.
 */
export function paymentsLocked(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  const mode = stripeKeyMode(key);
  if (mode === null) return true;
  if (mode === 'test') {
    return process.env.VERCEL_ENV === 'production' && process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION !== 'true';
  }
  return !(process.env.VERCEL_ENV === 'production' && process.env.BILLING_LIVE_PAYMENTS_APPROVED === 'true');
}

export const PAYMENTS_NOT_OPEN = {
  error: 'payments_not_open',
  message: 'Payments open soon. Your Free plan keeps working until then.',
} as const;

/** Monthly and annual checkout: configured, and payments not locked. */
export function checkoutOpen(): boolean {
  return stripeIsConfigured() && !paymentsLocked();
}

/** Pro Lifetime is hidden unless explicitly enabled (pending Preston's keep/drop decision). */
export function lifetimeCheckoutOpen(): boolean {
  return checkoutOpen() && Boolean(process.env.STRIPE_PRICE_PRO_LIFETIME?.trim()) && process.env.BILLING_LIFETIME_ENABLED?.trim() === 'true';
}

/**
 * Enterprise (monthly) and Big Business (one-time) checkout, for Stripe test mode work until live money is cleared.
 * Needs BILLING_NEW_TIERS_ENABLED exactly `true`, the plan's own Stripe price, and checkout open
 * (so every payment lock above still applies on top).
 */
export function newTierCheckoutOpen(plan: NewTierPlan): boolean {
  const key = plan === 'enterprise' ? 'STRIPE_PRICE_ENTERPRISE_MONTHLY' : 'STRIPE_PRICE_BUSINESS_LIFETIME';
  return newTiersEnabled() && checkoutOpen() && Boolean(process.env[key]?.trim());
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
