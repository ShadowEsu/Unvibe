import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { afterEach, mock } from 'node:test';
import type Stripe from 'stripe';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { processStripeEvent, type RefundTarget, type StripeWebhookDependencies } from '../src/billing/webhooks';
import { goodPayments } from './stripeFakes';

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
  const deps = { retrieveSubscription: async () => current, ...goodPayments };

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
    ...goodPayments,
  });
  const overview = await store.overview(userId);
  assert.equal(overview.subscription.status, 'active');
  assert.equal(overview.subscription.gracePeriodEndsAt, undefined);
});

test('a webhook claim is a lease: a delivery stuck in processing is re-claimed after it expires', async () => {
  let now = new Date('2026-10-22T10:00:00.000Z');
  const store = new MemoryBillingStore(() => now);
  const eventId = `evt_${randomUUID()}`;
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'claimed');
  // The function died: neither completeWebhook nor failWebhook ran.
  now = new Date('2026-10-22T10:04:59.000Z');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'in_progress', 'inside the lease a retry waits for the first delivery');
  now = new Date('2026-10-22T10:05:01.000Z');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'claimed', 'after the lease Stripe\'s retry processes the event');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'in_progress', 'the re-claim starts a new lease');
  await store.completeWebhook(eventId);
  now = new Date('2026-10-23T10:00:00.000Z');
  assert.equal(await store.claimWebhook(eventId, 'checkout.session.completed'), 'completed', 'a completed event is never processed again');
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
    const deps = { retrieveSubscription: async () => pastDue, ...goodPayments };
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
    await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', active), { retrieveSubscription: async () => active, ...goodPayments });
    await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', pastDue), deps);
    assert.equal((await store.overview(userId)).subscription.gracePeriodEndsAt, '2026-10-16T00:00:00.000Z');
  } finally {
    mock.timers.reset();
  }
});

function invoiceFailed(subscriptionId: string): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'invoice.payment_failed',
    data: { object: { parent: { subscription_details: { subscription: subscriptionId } } } },
  } as unknown as Stripe.Event;
}

test('events for an ended old subscription cannot replace the workspace\'s current one', async () => {
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const oldId = `sub_${randomUUID()}`;
  const newId = `sub_${randomUUID()}`;
  let old = { ...proSubscription(workspace.id, 'active'), id: oldId };
  const current = { ...proSubscription(workspace.id, 'active'), id: newId };
  const deps = { retrieveSubscription: async (id: string) => (id === oldId ? old : current), ...goodPayments };

  await processStripeEvent(store, subscriptionEvent('customer.subscription.created', old), deps);
  old = { ...old, status: 'canceled' };
  await processStripeEvent(store, { id: `evt_${randomUUID()}`, type: 'customer.subscription.deleted', data: { object: old } } as unknown as Stripe.Event, deps);
  // Re-subscribing replaces the ended subscription.
  await processStripeEvent(store, subscriptionEvent('customer.subscription.created', current), deps);
  assert.equal((await store.overview(userId)).subscription.stripeSubscriptionId, newId);

  // Retried or late deliveries for the old subscription arrive afterwards.
  await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', old), deps);
  await processStripeEvent(store, invoiceFailed(oldId), deps);
  const overview = await store.overview(userId);
  assert.equal(overview.subscription.stripeSubscriptionId, newId, 'the old subscription must not overwrite the current one');
  assert.equal(overview.subscription.status, 'active');
  assert.equal(overview.subscription.plan, 'pro');

  // Checkout completing for the current subscription still syncs it.
  const checkout = {
    id: `evt_${randomUUID()}`, type: 'checkout.session.completed',
    data: { object: { id: `cs_${randomUUID()}`, mode: 'subscription', subscription: newId, metadata: {} } },
  } as unknown as Stripe.Event;
  await processStripeEvent(store, checkout, deps);
  assert.equal((await store.overview(userId)).subscription.stripeSubscriptionId, newId);
});

test('a late failed payment on a canceled subscription does not start a grace period', async () => {
  const userId = randomUUID();
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  let current = { ...proSubscription(workspace.id, 'active'), id: `sub_${randomUUID()}` };
  const deps = { retrieveSubscription: async () => current, ...goodPayments };
  await processStripeEvent(store, subscriptionEvent('customer.subscription.created', current), deps);

  current = { ...current, status: 'canceled' };
  await processStripeEvent(store, { id: `evt_${randomUUID()}`, type: 'customer.subscription.deleted', data: { object: current } } as unknown as Stripe.Event, deps);
  await processStripeEvent(store, invoiceFailed(current.id), deps);
  const overview = await store.overview(userId);
  assert.equal(overview.subscription.status, 'canceled');
  assert.equal(overview.subscription.plan, 'free');
  assert.equal(overview.subscription.gracePeriodEndsAt, undefined);
});

/** A live Pro subscription as Stripe returns it, created at `created` (seconds). */
function liveSubscription(workspaceId: string, id: string, created: number, status: Stripe.Subscription.Status = 'active'): Stripe.Subscription {
  return { ...proSubscription(workspaceId, status), id, created };
}

/**
 * Stripe holding two subscriptions for one workspace: live state, each one's latest paid invoice
 * payments, and cancels and refunds that, like Stripe, replay the first result for a reused key.
 * With `refundErrorCode`, every refund fails with that Stripe error code.
 */
function twoSubscriptionsStripe(subscriptions: Record<string, Stripe.Subscription>, paid: Record<string, string[]>, refundErrorCode?: string) {
  const cancels: Array<{ id: string; key: string }> = [];
  const refunds: Array<{ target: RefundTarget; key: string }> = [];
  const refunded = new Map<string, string>();
  let failNextCancel = false;
  const deps: StripeWebhookDependencies = {
    retrieveSubscription: async (id) => {
      const live = subscriptions[id];
      if (!live) throw Object.assign(new Error(`No such subscription: '${id}'`), { code: 'resource_missing' });
      return live;
    },
    latestPaidInvoicePayments: async (id) => (paid[id] ?? []).map((paymentIntent) => ({ payment: { type: 'payment_intent', payment_intent: paymentIntent } }) as Stripe.InvoicePayment),
    retrievePaymentIntent: goodPayments.retrievePaymentIntent,
    refundPayment: async (target, key) => {
      refunds.push({ target, key });
      if (refundErrorCode) throw Object.assign(new Error('Stripe refused the refund'), { code: refundErrorCode });
      const refund = refunded.get(key) ?? `re_${randomUUID()}`;
      refunded.set(key, refund);
      return refund;
    },
    cancelSubscription: async (id, key) => {
      if (failNextCancel) {
        failNextCancel = false;
        throw new Error('Stripe is unavailable');
      }
      cancels.push({ id, key });
      subscriptions[id] = { ...subscriptions[id], status: 'canceled' };
    },
  };
  return { deps, cancels, refunds, refundIds: () => [...new Set(refunded.values())], failNextCancel: () => { failNextCancel = true; } };
}

afterEach(() => mock.restoreAll());

/** A memory store whose audit rows the test can read, with an alert spy on console.error (restored after each test). */
async function auditedWorkspace() {
  const store = new MemoryBillingStore();
  const audits: Array<{ action: string; workspaceId: string | null; metadata: Record<string, unknown> }> = [];
  const record = store.recordAudit.bind(store);
  store.recordAudit = async (userId, workspaceId, action, metadata = {}) => {
    audits.push({ action, workspaceId, metadata });
    return record(userId, workspaceId, action, metadata);
  };
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const alert = mock.method(console, 'error', () => undefined);
  return { store, audits, userId, workspaceId: workspace.id, alert };
}

test('a second live subscription for a paid workspace is refunded and canceled once, and the first stays on record', async () => {
  const c = await auditedWorkspace();
  const keptId = `sub_${randomUUID()}`;
  const duplicateId = `sub_${randomUUID()}`;
  const duplicatePayment = `pi_${randomUUID()}`;
  const stripe = twoSubscriptionsStripe({
    [keptId]: liveSubscription(c.workspaceId, keptId, 1_797_000_000),
    [duplicateId]: liveSubscription(c.workspaceId, duplicateId, 1_797_000_600),
  }, { [duplicateId]: [duplicatePayment] });
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, keptId, 1_797_000_000)), stripe.deps);

  // The first delivery refunds, then fails to cancel: the event fails and Stripe retries it.
  stripe.failNextCancel();
  const duplicate = subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, duplicateId, 1_797_000_600));
  await assert.rejects(processStripeEvent(c.store, duplicate, stripe.deps), /unavailable/);
  await processStripeEvent(c.store, duplicate, stripe.deps);
  // Later deliveries (the retry after success, the cancel's own update) change nothing.
  await processStripeEvent(c.store, duplicate, stripe.deps);
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.updated', liveSubscription(c.workspaceId, duplicateId, 1_797_000_600)), stripe.deps);

  const overview = await c.store.overview(c.userId);
  assert.equal(overview.subscription.stripeSubscriptionId, keptId, 'the subscription created first stays on the workspace');
  assert.equal(overview.subscription.plan, 'pro');
  assert.equal(overview.subscription.status, 'active');
  assert.deepEqual(stripe.cancels, [{ id: duplicateId, key: `uncode-dup-cancel-${duplicateId}` }]);
  const refundKey = `uncode-dup-refund-${duplicateId}-${duplicatePayment}`;
  assert.deepEqual(stripe.refunds, [
    { target: { payment_intent: duplicatePayment }, key: refundKey },
    { target: { payment_intent: duplicatePayment }, key: refundKey },
  ], 'the retried refund reuses its key, so Stripe refunds once');
  assert.equal(stripe.refundIds().length, 1);
  const rows = c.audits.filter((a) => a.action === 'subscription.duplicate');
  assert.deepEqual(rows, [{ action: 'subscription.duplicate', workspaceId: c.workspaceId, metadata: { kept: keptId, stopped: duplicateId, refunded: stripe.refundIds() } }]);
  assert.equal(c.alert.mock.callCount(), 1);
});

test('a live subscription replaces a stored one that already ended at Stripe, without canceling anything', async () => {
  for (const ended of ['canceled', 'missing'] as const) {
    const c = await auditedWorkspace();
    const oldId = `sub_${randomUUID()}`;
    const newId = `sub_${randomUUID()}`;
    const subscriptions: Record<string, Stripe.Subscription> = {
      [oldId]: liveSubscription(c.workspaceId, oldId, 1_797_000_000),
      [newId]: liveSubscription(c.workspaceId, newId, 1_797_000_600),
    };
    const stripe = twoSubscriptionsStripe(subscriptions, { [newId]: [`pi_${randomUUID()}`] });
    await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', subscriptions[oldId]), stripe.deps);
    // It ended at Stripe and the deletion event has not arrived (or Stripe no longer has it).
    if (ended === 'canceled') subscriptions[oldId] = { ...subscriptions[oldId], status: 'canceled' };
    else delete subscriptions[oldId];

    await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', subscriptions[newId]), stripe.deps);
    assert.equal((await c.store.overview(c.userId)).subscription.stripeSubscriptionId, newId, `stored one ${ended}`);
    assert.deepEqual(stripe.cancels, []);
    assert.deepEqual(stripe.refunds, []);
    assert.equal(c.audits.some((a) => a.action === 'subscription.duplicate'), false);
  }
});

test('when the stored subscription is the newer duplicate, the older incoming one is written and the stored one stopped', async () => {
  const c = await auditedWorkspace();
  const olderId = `sub_${randomUUID()}`;
  const newerId = `sub_${randomUUID()}`;
  const newerPayment = `pi_${randomUUID()}`;
  const stripe = twoSubscriptionsStripe({
    [olderId]: liveSubscription(c.workspaceId, olderId, 1_797_000_000),
    [newerId]: liveSubscription(c.workspaceId, newerId, 1_797_000_600),
  }, { [newerId]: [newerPayment], [olderId]: [`pi_${randomUUID()}`] });
  // The newer subscription's event is processed first.
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, newerId, 1_797_000_600)), stripe.deps);
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, olderId, 1_797_000_000)), stripe.deps);
  // Stripe then reports the stopped one deleted.
  await processStripeEvent(c.store, { id: `evt_${randomUUID()}`, type: 'customer.subscription.deleted', data: { object: { id: newerId } } } as unknown as Stripe.Event, stripe.deps);

  const overview = await c.store.overview(c.userId);
  assert.equal(overview.subscription.stripeSubscriptionId, olderId);
  assert.equal(overview.subscription.plan, 'pro');
  assert.equal(overview.subscription.status, 'active');
  assert.deepEqual(stripe.cancels, [{ id: newerId, key: `uncode-dup-cancel-${newerId}` }]);
  assert.deepEqual(stripe.refunds, [{ target: { payment_intent: newerPayment }, key: `uncode-dup-refund-${newerId}-${newerPayment}` }]);
  assert.deepEqual(c.audits.find((a) => a.action === 'subscription.duplicate')?.metadata, { kept: olderId, stopped: newerId, refunded: stripe.refundIds() });
  assert.equal(c.alert.mock.callCount(), 1);
});

test('a duplicate with no paid invoice yet (a trial) is canceled without a refund', async () => {
  const c = await auditedWorkspace();
  const keptId = `sub_${randomUUID()}`;
  const trialId = `sub_${randomUUID()}`;
  const stripe = twoSubscriptionsStripe({
    [keptId]: liveSubscription(c.workspaceId, keptId, 1_797_000_000),
    [trialId]: liveSubscription(c.workspaceId, trialId, 1_797_000_600, 'trialing'),
  }, {});
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, keptId, 1_797_000_000)), stripe.deps);
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, trialId, 1_797_000_600, 'trialing')), stripe.deps);

  assert.equal((await c.store.overview(c.userId)).subscription.stripeSubscriptionId, keptId);
  assert.deepEqual(stripe.cancels, [{ id: trialId, key: `uncode-dup-cancel-${trialId}` }]);
  assert.deepEqual(stripe.refunds, []);
  assert.deepEqual(c.audits.find((a) => a.action === 'subscription.duplicate')?.metadata, { kept: keptId, stopped: trialId, refunded: [] });
});

test('a duplicate whose payment was already refunded is still canceled once, and the event succeeds', async () => {
  const c = await auditedWorkspace();
  const keptId = `sub_${randomUUID()}`;
  const duplicateId = `sub_${randomUUID()}`;
  const duplicatePayment = `pi_${randomUUID()}`;
  // Support refunded the double charge in the Dashboard before this webhook ran.
  const stripe = twoSubscriptionsStripe({
    [keptId]: liveSubscription(c.workspaceId, keptId, 1_797_000_000),
    [duplicateId]: liveSubscription(c.workspaceId, duplicateId, 1_797_000_600),
  }, { [duplicateId]: [duplicatePayment] }, 'charge_already_refunded');
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, keptId, 1_797_000_000)), stripe.deps);
  const duplicate = subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, duplicateId, 1_797_000_600));
  await processStripeEvent(c.store, duplicate, stripe.deps);
  await processStripeEvent(c.store, duplicate, stripe.deps);

  assert.equal((await c.store.overview(c.userId)).subscription.stripeSubscriptionId, keptId);
  assert.deepEqual(stripe.cancels, [{ id: duplicateId, key: `uncode-dup-cancel-${duplicateId}` }], 'the duplicate stops billing');
  assert.deepEqual(c.audits.filter((a) => a.action === 'subscription.duplicate').map((a) => a.metadata), [
    { kept: keptId, stopped: duplicateId, refunded: [`already-refunded:${duplicatePayment}`] },
  ]);
});

test('any other refund error fails the event and cancels nothing, so Stripe retries it', async () => {
  const c = await auditedWorkspace();
  const keptId = `sub_${randomUUID()}`;
  const duplicateId = `sub_${randomUUID()}`;
  const stripe = twoSubscriptionsStripe({
    [keptId]: liveSubscription(c.workspaceId, keptId, 1_797_000_000),
    [duplicateId]: liveSubscription(c.workspaceId, duplicateId, 1_797_000_600),
  }, { [duplicateId]: [`pi_${randomUUID()}`] }, 'balance_insufficient');
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, keptId, 1_797_000_000)), stripe.deps);
  await assert.rejects(
    processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, duplicateId, 1_797_000_600)), stripe.deps),
    /refused the refund/,
  );

  assert.equal((await c.store.overview(c.userId)).subscription.stripeSubscriptionId, keptId);
  assert.deepEqual(stripe.cancels, []);
  assert.equal(c.audits.some((a) => a.action === 'subscription.duplicate'), false);
});

test('a live subscription that will not renew does not replace a stored one that still charges', async () => {
  const c = await auditedWorkspace();
  const chargingId = `sub_${randomUUID()}`;
  const endingId = `sub_${randomUUID()}`;
  const ending = { ...liveSubscription(c.workspaceId, endingId, 1_796_000_000), cancel_at_period_end: true };
  const stripe = twoSubscriptionsStripe({ [chargingId]: liveSubscription(c.workspaceId, chargingId, 1_797_000_000), [endingId]: ending }, {});
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.created', liveSubscription(c.workspaceId, chargingId, 1_797_000_000)), stripe.deps);
  await processStripeEvent(c.store, subscriptionEvent('customer.subscription.updated', ending), stripe.deps);

  assert.equal((await c.store.overview(c.userId)).subscription.stripeSubscriptionId, chargingId, 'the subscription that keeps charging stays on record');
  assert.deepEqual(stripe.cancels, []);
  assert.deepEqual(stripe.refunds, []);
});
