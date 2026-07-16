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
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is not configured.`);
  return value;
}

export function stripeIsConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim() &&
      process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_PRO_ANNUAL?.trim() &&
      process.env.STRIPE_PRICE_TEAMS_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_TEAMS_ANNUAL?.trim(),
  );
}

export function publicAppUrl(req: Request): string {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') throw new Error('PUBLIC_APP_URL is required in production.');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
