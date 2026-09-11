import type Stripe from 'stripe';
import type { BillingStore, BillingInterval, PlanId, SubscriptionStatus } from './types';
import { stripePriceId } from './stripe';

/** Far-future end date used for Pro Lifetime grants (effectively permanent). */
export const LIFETIME_PERIOD_END = '2099-12-31T23:59:59.000Z';

function mappedStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'trialing' || status === 'active' || status === 'past_due' || status === 'unpaid' || status === 'canceled') return status;
  return 'inactive';
}

function requiredMetadata(subscription: Stripe.Subscription): { workspaceId: string; plan: Exclude<PlanId, 'free'>; interval: BillingInterval } {
  const workspaceId = subscription.metadata.workspace_id;
  const plan = subscription.metadata.plan;
  const interval = subscription.metadata.interval;
  if (!workspaceId || (plan !== 'pro' && plan !== 'teams') || (interval !== 'monthly' && interval !== 'annual')) {
    throw new Error('Stripe subscription metadata is incomplete.');
  }
  return { workspaceId, plan, interval };
}

function providerId(value: string | { id: string } | null): string {
  if (!value) throw new Error('Stripe object is missing a provider identifier.');
  return typeof value === 'string' ? value : value.id;
}

export async function syncStripeSubscription(store: BillingStore, subscription: Stripe.Subscription, grace = false): Promise<void> {
  const metadata = requiredMetadata(subscription);
  const item = subscription.items.data[0];
  if (!item) throw new Error('Stripe subscription has no billable item.');
  if (item.price.id !== stripePriceId(metadata.plan, metadata.interval)) throw new Error('Stripe subscription price does not match the trusted plan configuration.');
  if (metadata.plan === 'pro' && (item.quantity ?? 1) !== 1) throw new Error('Pro subscriptions must have exactly one account seat.');
  if (metadata.plan === 'teams' && (item.quantity ?? 0) < 2) throw new Error('Teams subscriptions require at least two seats.');
  const graceDays = Math.max(1, Math.min(30, Number(process.env.BILLING_GRACE_PERIOD_DAYS ?? 7) || 7));
  const graceEnds = new Date(Date.now() + graceDays * 86_400_000).toISOString();
  const shouldGrace = grace || subscription.status === 'past_due';
  await store.syncSubscription({
    workspaceId: metadata.workspaceId,
    plan: metadata.plan,
    interval: metadata.interval,
    status: shouldGrace ? 'grace_period' : mappedStatus(subscription.status),
    seats: metadata.plan === 'teams' ? Math.max(2, item.quantity ?? 2) : 1,
    stripeCustomerId: providerId(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: item.price.id,
    currentPeriodStart: new Date(item.current_period_start * 1_000).toISOString(),
    currentPeriodEnd: new Date(item.current_period_end * 1_000).toISOString(),
    gracePeriodEndsAt: shouldGrace ? graceEnds : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

async function grantLifetimeFromCheckout(store: BillingStore, session: Stripe.Checkout.Session): Promise<void> {
  const workspaceId = session.metadata?.workspace_id;
  const plan = session.metadata?.plan;
  const interval = session.metadata?.interval;
  if (!workspaceId || plan !== 'pro' || interval !== 'lifetime') {
    throw new Error('Stripe lifetime checkout metadata is incomplete.');
  }
  const expectedPrice = stripePriceId('pro', 'lifetime');
  const linePrice = session.line_items?.data?.[0]?.price;
  const priceId = typeof linePrice === 'string' ? linePrice : linePrice?.id;
  if (priceId && priceId !== expectedPrice) {
    throw new Error('Stripe lifetime price does not match the trusted plan configuration.');
  }
  const customerId = providerId(session.customer);
  const paymentId = session.payment_intent
    ? providerId(session.payment_intent)
    : `lifetime_${session.id}`;
  const now = new Date().toISOString();
  await store.syncSubscription({
    workspaceId,
    plan: 'pro',
    interval: 'lifetime',
    status: 'active',
    seats: 1,
    stripeCustomerId: customerId,
    stripeSubscriptionId: paymentId,
    stripePriceId: expectedPrice,
    currentPeriodStart: now,
    currentPeriodEnd: LIFETIME_PERIOD_END,
    cancelAtPeriodEnd: false,
  });
  await store.completeCheckoutIntent(session.id);
  await store.recordAudit(session.metadata?.user_id ?? null, workspaceId, 'checkout.completed', {
    mode: 'payment',
    interval: 'lifetime',
  });
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return subscription ? providerId(subscription) : null;
}

export interface StripeWebhookDependencies {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  retrieveCheckoutSession?(id: string): Promise<Stripe.Checkout.Session>;
}

export async function processStripeEvent(store: BillingStore, event: Stripe.Event, deps: StripeWebhookDependencies): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'payment' && session.metadata?.interval === 'lifetime') {
        const full = deps.retrieveCheckoutSession
          ? await deps.retrieveCheckoutSession(session.id)
          : session;
        await grantLifetimeFromCheckout(store, full);
        return;
      }
      if (session.mode !== 'subscription' || !session.subscription) return;
      const subscription = await deps.retrieveSubscription(providerId(session.subscription));
      await syncStripeSubscription(store, subscription);
      await store.completeCheckoutIntent(session.id);
      await store.recordAudit(null, subscription.metadata.workspace_id ?? null, 'checkout.completed', { eventId: event.id });
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncStripeSubscription(store, event.data.object);
      return;
    case 'customer.subscription.deleted':
      {
      const prior = await store.subscriptionByProviderId(event.data.object.id);
      await store.markSubscriptionCanceled(event.data.object.id);
      await store.recordAudit(null, prior?.workspaceId ?? null, 'subscription.canceled', { eventId: event.id });
      return;
      }
    case 'invoice.payment_failed': {
      const id = subscriptionIdFromInvoice(event.data.object);
      if (id) await syncStripeSubscription(store, await deps.retrieveSubscription(id), true);
      return;
    }
    case 'invoice.paid': {
      const id = subscriptionIdFromInvoice(event.data.object);
      if (id) await syncStripeSubscription(store, await deps.retrieveSubscription(id));
      return;
    }
    default:
      return;
  }
}
