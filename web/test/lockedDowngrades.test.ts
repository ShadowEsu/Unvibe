import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import type Stripe from 'stripe';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { getBillingStore } from '../src/billing/store';
import { getStripe, paymentsLocked } from '../src/billing/stripe';

// Real route + memory store on a production deployment with a live-format key and no purchase
// approval: the emergency lock. The key is a fake string; the cached client's subscription lookup is
// replaced, so no request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.UNVIBE_CHECKOUT_LIVE;
delete process.env.BILLING_GRACE_PERIOD_DAYS;
process.env.STRIPE_SECRET_KEY = 'rk_live_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_localonly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual';
process.env.VERCEL_ENV = 'production';

const DAY_MS = 24 * 60 * 60 * 1000;
const STORED_END = '2026-12-01T00:00:00.000Z';
const stripe = getStripe();
/** What Stripe says each subscription is now. */
const live: Record<string, { status: Stripe.Subscription.Status; periodEnd: number }> = {};

stripe.subscriptions.retrieve = (async (id: string) => ({
  id, status: live[id]?.status ?? 'active', customer: 'cus_locked', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
  metadata: { workspace_id: 'unused-in-revoke-only', plan: 'pro', interval: 'monthly' },
  items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: live[id]?.periodEnd ?? 1_800_000_000 }] },
})) as unknown as typeof stripe.subscriptions.retrieve;

function deliver(type: string, subscriptionId: string, eventId = `evt_${randomUUID()}`): Promise<Response> {
  const object = type.startsWith('invoice.')
    ? { id: `in_${randomUUID()}`, object: 'invoice', parent: { subscription_details: { subscription: subscriptionId } } }
    : { id: subscriptionId, object: 'subscription' };
  const payload = JSON.stringify({ id: eventId, object: 'event', type, livemode: true, data: { object } });
  return webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_localonly' }) },
    body: payload,
  }));
}

/** A paying subscriber recorded before the lock went on: Pro, or Teams with `seats` seats. */
async function paidSubscriber(status: 'active' | 'canceled' = 'active', plan: 'pro' | 'teams' = 'pro', seats = 1) {
  const userId = randomUUID();
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const subscriptionId = `sub_${randomUUID()}`;
  await store.syncSubscription({
    workspaceId: workspace.id, plan, interval: 'monthly', status, seats,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: subscriptionId, stripePriceId: `price_${plan}_monthly`,
    currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: STORED_END, cancelAtPeriodEnd: false,
  });
  return {
    subscriptionId,
    row: async () => (await store.subscriptionByWorkspaceId(workspace.id))!,
    plan: async () => (await store.overview(userId, workspace.id)).subscription.plan,
  };
}

test('the lock is on for this deployment', () => {
  assert.equal(paymentsLocked(), true);
});

test('while locked, an unpaid or canceled subscription update still moves a paid row to Free', async () => {
  for (const [type, status] of [
    ['customer.subscription.updated', 'unpaid'],
    ['customer.subscription.updated', 'canceled'],
    ['invoice.payment_failed', 'unpaid'],
    ['invoice.paid', 'canceled'],
  ] as const) {
    const sub = await paidSubscriber();
    assert.equal(await sub.plan(), 'pro');
    live[sub.subscriptionId] = { status, periodEnd: 1_800_000_000 };
    const response = await deliver(type, sub.subscriptionId);
    assert.equal(response.status, 200, `${type} ${status}`);
    assert.deepEqual(await response.json(), { received: true }, `${type} ${status}`);
    assert.equal((await sub.row()).status, status, `${type} ${status}`);
    assert.equal(await sub.plan(), 'free', `${type} ${status} gives Free`);
  }
});

test('while locked, repeated payment failures start the grace period once and never restart it', async () => {
  const sub = await paidSubscriber();
  live[sub.subscriptionId] = { status: 'past_due', periodEnd: 1_800_000_000 };
  const start = Date.now();
  mock.timers.enable({ apis: ['Date'], now: start });
  try {
    assert.equal((await deliver('invoice.payment_failed', sub.subscriptionId)).status, 200);
    const first = await sub.row();
    assert.equal(first.status, 'grace_period');
    assert.equal(first.gracePeriodEndsAt, new Date(start + 7 * DAY_MS).toISOString());
    for (const days of [2, 5]) {
      mock.timers.setTime(start + days * DAY_MS);
      assert.equal((await deliver('invoice.payment_failed', sub.subscriptionId)).status, 200);
      assert.equal((await deliver('customer.subscription.updated', sub.subscriptionId)).status, 200);
      assert.equal((await sub.row()).gracePeriodEndsAt, first.gracePeriodEndsAt, `a failure on day ${days} keeps the first grace end`);
    }
    mock.timers.setTime(start + 8 * DAY_MS);
    assert.equal((await deliver('invoice.payment_failed', sub.subscriptionId)).status, 200);
    assert.equal((await sub.row()).gracePeriodEndsAt, first.gracePeriodEndsAt);
    assert.equal(await sub.plan(), 'free', 'the grace period ran out');
  } finally {
    mock.timers.reset();
  }
});

test('while locked, a failed renewal that Stripe then collects ends the grace period, and the account is still Pro on day 8', async () => {
  const sub = await paidSubscriber();
  live[sub.subscriptionId] = { status: 'past_due', periodEnd: 1_800_000_000 };
  const start = Date.now();
  const store = getBillingStore();
  const record = store.recordAudit.bind(store);
  const audits: string[] = [];
  store.recordAudit = async (userId, workspaceId, action, metadata) => {
    if (metadata?.stripeSubscriptionId === sub.subscriptionId) audits.push(`${action}:${String(metadata.status)}`);
    return record(userId, workspaceId, action, metadata);
  };
  mock.timers.enable({ apis: ['Date'], now: start });
  try {
    assert.equal((await deliver('invoice.payment_failed', sub.subscriptionId)).status, 200);
    assert.equal((await sub.row()).status, 'grace_period');
    mock.timers.setTime(start + 3 * DAY_MS);
    live[sub.subscriptionId] = { status: 'active', periodEnd: 1_900_000_000 };
    assert.equal((await deliver('invoice.paid', sub.subscriptionId)).status, 200);
    assert.deepEqual(audits, ['subscription.revoked_while_locked:grace_period', 'subscription.recovered_while_locked:active'], 'the recovery is audited as a recovery');
    const recovered = await sub.row();
    assert.equal(recovered.status, 'active');
    assert.equal(recovered.gracePeriodEndsAt, undefined);
    assert.equal(recovered.currentPeriodEnd, STORED_END, 'the stored period is kept, not extended');
    assert.equal(recovered.plan, 'pro');
    mock.timers.setTime(start + 8 * DAY_MS);
    assert.equal((await deliver('customer.subscription.updated', sub.subscriptionId)).status, 200);
    assert.equal((await sub.row()).status, 'active');
    assert.equal(await sub.plan(), 'pro', 'still Pro on day 8, after the grace period would have ended');
  } finally {
    mock.timers.reset();
    store.recordAudit = record;
  }
});

test('while locked, only active or trialing at Stripe ends a grace period: unpaid, paused or expired removes access, and past_due keeps the first grace end', async () => {
  const start = Date.now();
  mock.timers.enable({ apis: ['Date'], now: start });
  try {
    for (const [liveStatus, expected] of [
      ['unpaid', 'unpaid'],
      ['paused', 'inactive'],
      ['incomplete_expired', 'inactive'],
    ] as const) {
      mock.timers.setTime(start);
      const sub = await paidSubscriber();
      live[sub.subscriptionId] = { status: 'past_due', periodEnd: 1_800_000_000 };
      assert.equal((await deliver('invoice.payment_failed', sub.subscriptionId)).status, 200);
      assert.equal((await sub.row()).status, 'grace_period', liveStatus);
      mock.timers.setTime(start + 2 * DAY_MS);
      live[sub.subscriptionId] = { status: liveStatus, periodEnd: 1_900_000_000 };
      for (const type of ['customer.subscription.updated', 'invoice.paid']) {
        assert.equal((await deliver(type, sub.subscriptionId)).status, 200, `${liveStatus} ${type}`);
        const row = await sub.row();
        assert.equal(row.status, expected, `${liveStatus} ${type}: not recovered`);
        assert.equal(row.currentPeriodEnd, STORED_END, `${liveStatus} ${type}: period not extended`);
        assert.equal(await sub.plan(), 'free', `${liveStatus} ${type}: no paid access`);
      }
    }

    // past_due again on day 3: still in grace, with the end set by the first failure.
    mock.timers.setTime(start);
    const pastDue = await paidSubscriber();
    live[pastDue.subscriptionId] = { status: 'past_due', periodEnd: 1_800_000_000 };
    assert.equal((await deliver('invoice.payment_failed', pastDue.subscriptionId)).status, 200);
    const first = await pastDue.row();
    mock.timers.setTime(start + 3 * DAY_MS);
    for (const type of ['customer.subscription.updated', 'invoice.paid', 'invoice.payment_failed']) {
      assert.equal((await deliver(type, pastDue.subscriptionId)).status, 200, `past_due ${type}`);
      const row = await pastDue.row();
      assert.equal(row.status, 'grace_period', `past_due ${type}`);
      assert.equal(row.gracePeriodEndsAt, first.gracePeriodEndsAt, `past_due ${type}: grace not restarted`);
    }
    assert.equal(await pastDue.plan(), 'pro', 'grace still running on day 3');
  } finally {
    mock.timers.reset();
  }
});

test('while locked, a row canceled between the recovery\'s read and its write stays canceled', async () => {
  for (const [first, then, type] of [
    ['past_due', 'active', 'invoice.paid'],
    [null, 'past_due', 'invoice.payment_failed'],
  ] as const) {
    const sub = await paidSubscriber();
    if (first) {
      live[sub.subscriptionId] = { status: first, periodEnd: 1_800_000_000 };
      assert.equal((await deliver('invoice.payment_failed', sub.subscriptionId)).status, 200);
      assert.equal((await sub.row()).status, 'grace_period');
    }
    live[sub.subscriptionId] = { status: then, periodEnd: 1_800_000_000 };
    const store = getBillingStore();
    const read = store.subscriptionByProviderId.bind(store);
    let raced = false;
    // A lost dispute marks the row canceled right after this delivery read it.
    store.subscriptionByProviderId = async (id) => {
      const row = await read(id);
      if (id === sub.subscriptionId && !raced) {
        raced = true;
        await store.markSubscriptionCanceled(id);
      }
      return row;
    };
    try {
      assert.equal((await deliver(type, sub.subscriptionId)).status, 200, type);
    } finally {
      store.subscriptionByProviderId = read;
    }
    assert.equal(raced, true);
    assert.equal((await sub.row()).status, 'canceled', `${type}: the cancel is kept`);
    assert.equal(await sub.plan(), 'free', `${type}: no paid access`);
  }
});

test('while locked, subscription and invoice events never create, restore or extend Pro', async () => {
  // Stripe says active with a later period: the stored period is not extended.
  const paid = await paidSubscriber();
  live[paid.subscriptionId] = { status: 'active', periodEnd: 1_900_000_000 };
  for (const type of ['customer.subscription.updated', 'invoice.paid']) {
    assert.equal((await deliver(type, paid.subscriptionId)).status, 200, type);
  }
  assert.equal((await paid.row()).currentPeriodEnd, STORED_END);
  assert.equal((await paid.row()).status, 'active');

  // A canceled row is not restored by an active (or past-due) subscription at Stripe.
  const ended = await paidSubscriber('canceled');
  for (const status of ['active', 'past_due'] as const) {
    live[ended.subscriptionId] = { status, periodEnd: 1_900_000_000 };
    assert.equal((await deliver('customer.subscription.updated', ended.subscriptionId)).status, 200, status);
    assert.equal((await ended.row()).status, 'canceled', status);
    assert.equal(await ended.plan(), 'free', status);
  }

  // A subscription the store has never seen is not stored.
  const unknown = `sub_${randomUUID()}`;
  live[unknown] = { status: 'active', periodEnd: 1_900_000_000 };
  assert.equal((await deliver('customer.subscription.updated', unknown)).status, 200);
  assert.equal(await getBillingStore().subscriptionByProviderId(unknown), null);

  // Events that can only grant stay ignored.
  for (const type of ['customer.subscription.created', 'checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
    const response = await deliver(type, unknown);
    assert.deepEqual(await response.json(), { ignored: 'payments_locked' }, type);
  }
  assert.equal(await getBillingStore().subscriptionByProviderId(unknown), null);
});

test('while locked, a Teams downgrade moves only the status: plan, seats and period stay as stored', async () => {
  // Stripe's subscription carries 1 seat, Pro metadata and a later period; none of it is applied.
  for (const [type, status, expected] of [
    ['invoice.payment_failed', 'past_due', 'grace_period'],
    ['customer.subscription.updated', 'unpaid', 'unpaid'],
    ['invoice.paid', 'canceled', 'canceled'],
  ] as const) {
    const team = await paidSubscriber('active', 'teams', 5);
    const before = await team.row();
    live[team.subscriptionId] = { status, periodEnd: 1_900_000_000 };
    assert.equal((await deliver(type, team.subscriptionId)).status, 200, `${type} ${status}`);
    const after = await team.row();
    assert.equal(after.status, expected, `${type} ${status}`);
    assert.equal(after.plan, 'teams', `${type} ${status}: plan unchanged`);
    assert.equal(after.seats, 5, `${type} ${status}: seats unchanged`);
    assert.equal(after.interval, before.interval, `${type} ${status}: interval unchanged`);
    assert.equal(after.currentPeriodStart, before.currentPeriodStart, `${type} ${status}: period start unchanged`);
    assert.equal(after.currentPeriodEnd, STORED_END, `${type} ${status}: period end unchanged`);
    assert.equal(after.stripePriceId, 'price_teams_monthly', `${type} ${status}: price unchanged`);
    assert.equal(await team.plan(), expected === 'grace_period' ? 'teams' : 'free', `${type} ${status}: effective plan`);
  }
});

test('while locked, a revoke-only delivery that failed releases its claim, its retry applies, and a duplicate changes nothing', async () => {
  const sub = await paidSubscriber();
  live[sub.subscriptionId] = { status: 'unpaid', periodEnd: 1_800_000_000 };
  const eventId = `evt_${randomUUID()}`;
  const retrieve = stripe.subscriptions.retrieve;
  let lookups = 0;
  let failNext = true;
  stripe.subscriptions.retrieve = (async (...args: Parameters<typeof retrieve>) => {
    lookups += 1;
    if (failNext) {
      failNext = false;
      throw new Error('Stripe could not be reached.');
    }
    return retrieve(...args);
  }) as typeof retrieve;
  const original = console.error;
  console.error = () => undefined;
  try {
    const failed = await deliver('customer.subscription.updated', sub.subscriptionId, eventId);
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: 'processing_failed' });
    assert.equal((await sub.row()).status, 'active', 'nothing applied by the failed delivery');

    // The failure released the claim, so Stripe's retry of the same event runs and applies it.
    const retried = await deliver('customer.subscription.updated', sub.subscriptionId, eventId);
    assert.equal(retried.status, 200);
    assert.deepEqual(await retried.json(), { received: true });
    assert.equal((await sub.row()).status, 'unpaid');
    assert.equal(lookups, 2);

    // A duplicate delivery of the completed event is acknowledged without a Stripe call or a write.
    live[sub.subscriptionId] = { status: 'canceled', periodEnd: 1_800_000_000 };
    const duplicate = await deliver('customer.subscription.updated', sub.subscriptionId, eventId);
    assert.equal(duplicate.status, 200);
    assert.deepEqual(await duplicate.json(), { received: true, duplicate: true });
    assert.equal(lookups, 2, 'no Stripe lookup for the duplicate');
    assert.equal((await sub.row()).status, 'unpaid', 'the duplicate wrote nothing');
  } finally {
    console.error = original;
    stripe.subscriptions.retrieve = retrieve;
  }
});
