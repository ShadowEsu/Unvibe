import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { mock } from 'node:test';
import type Stripe from 'stripe';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { processStripeEvent } from '../src/billing/webhooks';

process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';

function proSubscription(workspaceId: string, status: Stripe.Subscription.Status): Stripe.Subscription {
  // Only the fields syncStripeSubscription reads; the SDK type has hundreds more.
  return {
    id: 'sub_order', status, customer: 'cus_order', cancel_at_period_end: false,
    metadata: { workspace_id: workspaceId, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
}

function subscriptionEvent(type: 'customer.subscription.created' | 'customer.subscription.updated', object: Stripe.Subscription): Stripe.Event {
  return { id: `evt_${randomUUID()}`, type, data: { object } } as unknown as Stripe.Event;
}

test('a late, stale subscription.updated cannot resurrect a canceled subscription', async () => {
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  let current = proSubscription(workspace.id, 'active');
  const deps = { retrieveSubscription: async () => current };

  await processStripeEvent(store, subscriptionEvent('customer.subscription.created', current), deps);
  assert.equal((await store.overview(userId)).subscription.plan, 'pro');

  // Stripe cancels; the deletion arrives first, then an older "active" update arrives late.
  current = proSubscription(workspace.id, 'canceled');
  await processStripeEvent(store, { id: 'evt_deleted', type: 'customer.subscription.deleted', data: { object: current } } as unknown as Stripe.Event, deps);
  await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', proSubscription(workspace.id, 'active')), deps);
  const overview = await store.overview(userId);
  assert.equal(overview.subscription.status, 'canceled');
  assert.equal(overview.subscription.plan, 'free');
});

test('an out-of-order past_due update cannot override a newer paid state', async () => {
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const current = proSubscription(workspace.id, 'active');
  await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', proSubscription(workspace.id, 'past_due')), {
    retrieveSubscription: async () => current,
  });
  const overview = await store.overview(userId);
  assert.equal(overview.subscription.status, 'active');
  assert.equal(overview.subscription.gracePeriodEndsAt, undefined);
});

test('a webhook claim is a lease: a delivery stuck in processing is re-claimed after it expires', async () => {
  let now = new Date('2026-10-22T10:00:00.000Z');
  const store = new MemoryBillingStore(() => now);
  const eventId = `evt_${randomUUID()}`;
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), true);
  // The function died: neither completeWebhook nor failWebhook ran.
  now = new Date('2026-10-22T10:04:59.000Z');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), false, 'inside the lease a retry is a duplicate');
  now = new Date('2026-10-22T10:05:01.000Z');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), true, 'after the lease Stripe\'s retry processes the event');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), false, 'the re-claim starts a new lease');
  await store.completeWebhook(eventId);
  now = new Date('2026-10-23T10:00:00.000Z');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), false, 'a completed event is never processed again');
});

test('the grace period after a failed payment ends on time; later failed retries do not extend it', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-01T00:00:00.000Z') });
  try {
    const userId = randomUUID();
    const store = new MemoryBillingStore(() => new Date());
    const workspace = await store.ensurePersonalWorkspace(userId);
    // Memory billing data is shared across tests; use this test's own Stripe subscription id.
    const id = `sub_${randomUUID()}`;
    const pastDue = { ...proSubscription(workspace.id, 'past_due'), id };
    const deps = { retrieveSubscription: async () => pastDue };
    await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', pastDue), deps);
    const firstEnd = (await store.overview(userId)).subscription.gracePeriodEndsAt;
    assert.equal(firstEnd, '2026-10-08T00:00:00.000Z');

    // Stripe retries the card on day 5 and it fails again.
    mock.timers.setTime(new Date('2026-10-06T00:00:00.000Z').getTime());
    await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', pastDue), deps);
    assert.equal((await store.overview(userId)).subscription.gracePeriodEndsAt, firstEnd);

    mock.timers.setTime(new Date('2026-10-09T00:00:00.000Z').getTime());
    assert.equal((await store.overview(userId)).subscription.plan, 'free', 'Pro ends when the grace period does');

    // A later, separate payment failure after recovery starts a fresh grace period.
    const active = { ...proSubscription(workspace.id, 'active'), id };
    await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', active), { retrieveSubscription: async () => active });
    await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', pastDue), deps);
    assert.equal((await store.overview(userId)).subscription.gracePeriodEndsAt, '2026-10-16T00:00:00.000Z');
  } finally {
    mock.timers.reset();
  }
});
