import Stripe from 'stripe';
import { stripeKeyMode, webhookSecretValid } from './stripeKey';
import type { BillingInterval, PlanId } from './types';

let stripeClient: Stripe | undefined;

/**
 * The Stripe client, only for an accepted key (`stripeKeyMode`: a test key or a restricted live key): any other
 * value throws before a client exists, so nothing is sent with it. It does not check the payment
 * lock: cancellations, refunds and account deletion keep serving existing customers while purchases
 * are locked, and each purchase path checks the lock itself.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key === undefined || stripeKeyMode(key) === null) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY on the server to a test key or a restricted live key.');
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
    stripeKeyMode(process.env.STRIPE_SECRET_KEY) !== null &&
      webhookSecretValid(process.env.STRIPE_WEBHOOK_SECRET) &&
      process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_PRO_ANNUAL?.trim(),
  );
}

/**
 * Checkout stays closed until Preston opens it (Security L3, 2 Nov):
 * - a live key (restricted `rk_live_` only, see `stripeKeyMode`) opens checkout only on the production
 *   deployment, and only with UNVIBE_CHECKOUT_LIVE set to exactly `1` (nothing else truthy, no trimming);
 *   a preview or a local server with a live key is always closed;
 * - a test key on the production deployment is closed too (it would grant real Pro for card 4242
 *   and refuse every real card) unless BILLING_TEST_CHECKOUT_IN_PRODUCTION is exactly `true` (no trimming).
 * Test keys on previews and local servers stay open, so sandbox checkout keeps working. A key that is
 * set but not accepted (`stripeKeyMode` is null, which includes `sk_live_`) is always locked.
 */
export function paymentsLocked(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  const mode = stripeKeyMode(key);
  if (mode === null) return true;
  if (mode === 'test') {
    return process.env.VERCEL_ENV === 'production' && process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION !== 'true';
  }
  return !(process.env.VERCEL_ENV === 'production' && process.env.UNVIBE_CHECKOUT_LIVE === '1');
}

/** What the health probe reports (Security L4): `off` while checkout is closed, else the key's mode. Values only. */
export function billingMode(): 'off' | 'test' | 'live' {
  return checkoutOpen() ? (stripeKeyMode(process.env.STRIPE_SECRET_KEY) ?? 'off') : 'off';
}

/** The webhook can verify events: an accepted key and a real `whsec_` signing secret. */
export function webhookConfigured(): boolean {
  return stripeKeyMode(process.env.STRIPE_SECRET_KEY) !== null && webhookSecretValid(process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Stripe Tax on Checkout (Preston, ledger 415): off until he has turned Stripe Tax on in the Dashboard and
 * STRIPE_AUTOMATIC_TAX is set to exactly `1`. A returning customer's address is saved back to the customer,
 * which Stripe needs to calculate tax for an existing customer.
 */
export function automaticTax(reusesCustomer: boolean): Pick<Stripe.Checkout.SessionCreateParams, 'automatic_tax' | 'customer_update'> {
  if (process.env.STRIPE_AUTOMATIC_TAX !== '1') return {};
  return { automatic_tax: { enabled: true }, ...(reusesCustomer ? { customer_update: { address: 'auto' } } : {}) };
}

/**
 * Terms of Service consent on Checkout (Security L6), with a live key only: Stripe refuses
 * `consent_collection.terms_of_service` until the account's public details carry a Terms URL, which
 * Preston sets on the live account; the sandbox has none, so sandbox checkout sends nothing here.
 */
export function termsConsent(): Pick<Stripe.Checkout.SessionCreateParams, 'consent_collection'> {
  return stripeKeyMode(process.env.STRIPE_SECRET_KEY) === 'live' ? { consent_collection: { terms_of_service: 'required' } } : {};
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

export function publicAppUrl(req: Request): string {
  // APP_URL is deliberately server-only. The old PUBLIC_APP_URL name is kept
  // as a migration fallback for existing deployments.
  const configured = process.env.APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') throw new Error('APP_URL is required in production.');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
