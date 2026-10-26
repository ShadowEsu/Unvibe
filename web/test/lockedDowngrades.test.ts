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
delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
delete process.env.BILLING_GRACE_PERIOD_DAYS;
process.env.STRIPE_SECRET_KEY = 'sk_live_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
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

function deliver(type: string, subscriptionId: string): Promise<Response> {
  const object = type.startsWith('invoice.')
    ? { id: `in_${randomUUID()}`, object: 'invoice', parent: { subscription_details: { subscription: subscriptionId } } }
    : { id: subscriptionId, object: 'subscription' };
  const payload = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', type, livemode: true, data: { object } });
  return webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' }) },
    body: payload,
  }));
}

/** A paying Pro subscriber recorded before the lock went on. */
async function paidSubscriber(status: 'active' | 'canceled' = 'active') {
  const userId = randomUUID();
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const subscriptionId = `sub_${randomUUID()}`;
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status, seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: subscriptionId, stripePriceId: 'price_pro_monthly',
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
