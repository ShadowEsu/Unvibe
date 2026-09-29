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

/** One-time Pro Lifetime requires its own trusted Price ID. */
export function stripeLifetimeConfigured(): boolean {
  return stripeIsConfigured() && Boolean(process.env.STRIPE_PRICE_PRO_LIFETIME?.trim());
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
