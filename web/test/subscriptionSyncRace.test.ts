import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type Stripe from 'stripe';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import type { BillingStore } from '../src/billing/types';
import { processStripeEvent, type StripeWebhookDependencies } from '../src/billing/webhooks';

// The unlocked-upsert race (Security 0344, round 2 N2 and the before-live list): the subscription
// sync reads the row, decides, and writes the whole row. Another write that lands in between (a lost
// dispute or a refund that cancels it, a free-months grant) must not be overwritten by the older
// decision. The memory store is real; a wrapper runs the other write right after the sync's read.
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';

const READS: Record<string, true> = { subscriptionByWorkspaceId: true, versionedSubscriptionByWorkspaceId: true };

/** The store, with `between` run after each of the first `times` reads of the workspace's row. */
function racing(store: BillingStore, between: () => Promise<void>, times = 1): BillingStore {
  let left = times;
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') return value;
      if (!READS[String(property)]) return value.bind(target);
      return async (...args: unknown[]) => {
        const result = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        if (left > 0) {
          left -= 1;
          await between();
        }
        return result;
      };
    },
  });
}

function subscription(id: string, workspaceId: string, status: Stripe.Subscription.Status): Stripe.Subscription {
  return {
    id, status, customer: 'cus_race', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
    metadata: { workspace_id: workspaceId, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
}

function updated(id: string): Stripe.Event {
  return { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', livemode: false, data: { object: { id, object: 'subscription' } } } as unknown as Stripe.Event;
}

async function storedPaid(store: MemoryBillingStore, userId: string, status: 'active' | 'canceled') {
  const workspace = await store.ensurePersonalWorkspace(userId);
  const id = `sub_${randomUUID()}`;
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status, seats: 1,
    stripeCustomerId: 'cus_race', stripeSubscriptionId: id, stripePriceId: 'price_pro_monthly',
    currentPeriodStart: '2026-12-15T00:00:00.000Z', currentPeriodEnd: '2027-01-15T00:00:00.000Z', cancelAtPeriodEnd: false,
  });
  return { workspaceId: workspace.id, id };
}

test('a lost dispute that cancels the row between the sync\'s read and its write leaves it canceled', async () => {
  const store = new MemoryBillingStore();
  const userId = randomUUID();
  const { workspaceId, id } = await storedPaid(store, userId, 'active');
  // Stripe answers active for this event's first read; the dispute handler then cancels it at Stripe.
  let stripeStatus: Stripe.Subscription.Status = 'active';
  const deps: StripeWebhookDependencies = { retrieveSubscription: async (subscriptionId) => subscription(subscriptionId, workspaceId, stripeStatus) };
  const dispute = async () => {
    stripeStatus = 'canceled';
    await store.markSubscriptionCanceled(id);
  };
  await processStripeEvent(racing(store, dispute), updated(id), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'canceled');
  assert.equal((await store.overview(userId)).subscription.plan, 'free');
});

test('a late active snapshot of a subscription the row already records as canceled does not bring it back', async () => {
  // The refund handler canceled it at Stripe and marked the row after this event's Stripe read.
  const store = new MemoryBillingStore();
  const userId = randomUUID();
  const { workspaceId, id } = await storedPaid(store, userId, 'canceled');
  const deps: StripeWebhookDependencies = { retrieveSubscription: async (subscriptionId) => subscription(subscriptionId, workspaceId, 'active') };
  await processStripeEvent(store, updated(id), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'canceled');
  assert.equal((await store.overview(userId)).subscription.plan, 'free');
});

test('free months granted between the sync\'s read and its write are kept', async () => {
  const store = new MemoryBillingStore();
  const userId = randomUUID();
  const { workspaceId, id } = await storedPaid(store, userId, 'canceled');
  // A late event for the old, ended subscription; a promo redemption lands while it syncs.
  const deps: StripeWebhookDependencies = { retrieveSubscription: async (subscriptionId) => subscription(subscriptionId, workspaceId, 'canceled') };
  const grant = async () => { assert.deepEqual(await store.addProMonths(userId, 1), { applied: true }); };
  await processStripeEvent(racing(store, grant), updated(id), deps);
  const row = await store.subscriptionByWorkspaceId(workspaceId);
  assert.equal(row?.status, 'trialing');
  assert.equal(row?.stripeSubscriptionId, undefined);
  assert.equal((await store.overview(userId)).subscription.plan, 'pro');
});

test('a sync that loses the compare-and-set every time fails the event, so Stripe retries it', async () => {
  const store = new MemoryBillingStore();
  const userId = randomUUID();
  const { workspaceId, id } = await storedPaid(store, userId, 'active');
  const deps: StripeWebhookDependencies = { retrieveSubscription: async (subscriptionId) => subscription(subscriptionId, workspaceId, 'active') };
  // Some other write touches the row (here a seat-neutral period nudge) after every read.
  const touch = async () => {
    const row = await store.subscriptionByWorkspaceId(workspaceId);
    assert.ok(row?.stripeSubscriptionId && row.stripeCustomerId && row.stripePriceId && row.interval);
    await store.syncSubscription({ ...row, plan: 'pro', interval: row.interval, stripeSubscriptionId: row.stripeSubscriptionId, stripeCustomerId: row.stripeCustomerId, stripePriceId: row.stripePriceId, currentPeriodEnd: new Date().toISOString() });
  };
  await assert.rejects(processStripeEvent(racing(store, touch, 10), updated(id), deps), /concurrent changes/);
});

test('a lost compare-and-set retrieves the subscription again, so an older snapshot never overwrites a newer sync', async () => {
  const store = new MemoryBillingStore();
  const userId = randomUUID();
  const { workspaceId, id } = await storedPaid(store, userId, 'active');
  let stripeStatus: Stripe.Subscription.Status = 'active';
  let retrieved = 0;
  const deps: StripeWebhookDependencies = { retrieveSubscription: async (subscriptionId) => { retrieved += 1; return subscription(subscriptionId, workspaceId, stripeStatus); } };
  // A renewal fails and that event is synced while this one sits between its read and its write.
  const failedRenewal = async () => {
    stripeStatus = 'past_due';
    await processStripeEvent(store, updated(id), deps);
  };
  await processStripeEvent(racing(store, failedRenewal), updated(id), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'grace_period');
  assert.equal(retrieved, 3, 'this event, the racing event, and this event again after losing the compare-and-set');
});
