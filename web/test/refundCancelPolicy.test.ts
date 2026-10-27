import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type Stripe from 'stripe';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { processStripeEvent, type StripeWebhookDependencies } from '../src/billing/webhooks';
import { paidPayment, paymentIntent, periodInvoice } from './stripeFakes';

// When a refund or dispute ends a subscription at Stripe (Security H1, H2, H7, A-b). Only a FULL
// refund of the invoice that pays the current period cancels at Stripe. A partial refund, an open
// dispute, or a full refund of another invoice (a proration) refuses a new grant but never cancels
// and never takes away access already granted. A grant refused before the write because of a full
// refund of the current period's invoice cancels at Stripe too, so the subscription stops charging.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnlyNeverSent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = 'price_enterprise_monthly';
process.env.BILLING_NEW_TIERS_ENABLED = 'true';

type Intent = (id: string) => Stripe.PaymentIntent;
const good: Intent = (id) => paymentIntent(id);
const fullyRefunded: Intent = (id) => paymentIntent(id, { refunded: true, amount_refunded: 500_000 });
const partlyRefunded: Intent = (id) => paymentIntent(id, { amount_refunded: 50_000 });
const disputed: Intent = (id) => paymentIntent(id, { disputed: true });
const T1 = 1_797_000_100;
const T2 = 1_797_000_200;
const T3 = 1_797_000_300;
const PERIOD_START = 1_797_321_600;
/** A mid-period plan or seat change invoiced at once: a paid invoice that does not pay the current period. */
const PRORATION_START = PERIOD_START + 78_400;

async function customer() {
  const store = new MemoryBillingStore();
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const audits: string[] = [];
  const record = store.recordAudit.bind(store);
  store.recordAudit = async (user, workspaceId, action, metadata = {}) => {
    audits.push(`${action}${typeof metadata.reason === 'string' ? `:${metadata.reason}` : ''}`);
    return record(user, workspaceId, action, metadata);
  };
  return { store, userId, workspaceId: workspace.id, audits };
}

const plan = async (c: { store: MemoryBillingStore; userId: string }) => (await c.store.overview(c.userId)).subscription.plan;

function event(type: string, object: unknown, created = T1): Stripe.Event {
  return { id: `evt_${randomUUID()}`, type, livemode: false, created, data: { object } } as unknown as Stripe.Event;
}

function subscription(workspaceId: string, plan: 'pro' | 'enterprise'): Stripe.Subscription {
  return {
    id: `sub_${randomUUID()}`, status: 'active', customer: `cus_${randomUUID()}`, cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
    metadata: { workspace_id: workspaceId, plan, interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: `price_${plan}_monthly` }, current_period_start: PERIOD_START, current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
}

const invoicePaid = (subscriptionId: string, created: number) =>
  event('invoice.paid', { id: `in_${randomUUID()}`, parent: { subscription_details: { subscription: subscriptionId } } }, created);

const fullRefundEvent = (pi: string, customerId: string, created: number) =>
  event('charge.refunded', { id: `ch_${randomUUID()}`, object: 'charge', amount: 500_000, amount_refunded: 500_000, refunded: true, currency: 'usd', payment_intent: pi, customer: customerId }, created);

/** Stripe as the webhook sees it: `live` subscription, one paid payment on its latest invoice (the current period's), and every cancel recorded. */
function stripe(live: () => Stripe.Subscription, pi: string, intent: () => Intent, cancels: string[], extra: Partial<StripeWebhookDependencies> = {}): StripeWebhookDependencies {
  return {
    retrieveSubscription: async () => live(),
    invoicesForPaymentIntent: async () => [],
    latestPaidInvoicePayments: async () => [paidPayment(pi, periodInvoice(live().id, PERIOD_START))],
    retrievePaymentIntent: async (id) => intent()(id),
    cancelSubscription: async (_id, key) => { cancels.push(key); },
    ...extra,
  };
}

test('H1: a paying Pro subscription keeps access and is never canceled at Stripe after a partial refund or an open dispute, even by an event stamped the same second', async () => {
  for (const [label, after] of [['partial refund', partlyRefunded], ['open dispute', disputed]] as const) {
    for (const second of [T1, T2]) {
      const c = await customer();
      const sub = subscription(c.workspaceId, 'pro');
      const cancels: string[] = [];
      let intent = good;
      const deps = stripe(() => sub, `pi_${randomUUID()}`, () => intent, cancels);
      await processStripeEvent(c.store, event('customer.subscription.created', { id: sub.id }, T1), deps);
      assert.equal(await plan(c), 'pro', label);
      intent = after;
      await processStripeEvent(c.store, invoicePaid(sub.id, second), deps);
      assert.equal(await plan(c), 'pro', `${label}, event at ${second === T1 ? 'the same second' : 'a later second'}`);
      assert.deepEqual(cancels, [], label);
    }
  }
});

test('H1: a full refund seen on a same-second event still cancels at Stripe once and ends access', async () => {
  const c = await customer();
  const sub = subscription(c.workspaceId, 'pro');
  const cancels: string[] = [];
  let intent = good;
  const deps = stripe(() => sub, `pi_${randomUUID()}`, () => intent, cancels);
  await processStripeEvent(c.store, event('customer.subscription.created', { id: sub.id }, T1), deps);
  intent = fullyRefunded;
  await processStripeEvent(c.store, invoicePaid(sub.id, T1), deps);
  assert.equal(await plan(c), 'free');
  assert.deepEqual(cancels, [`uncode-revoke-${sub.id}`]);
  assert.ok(c.audits.includes('subscription.refused_payment:refunded'));
});

test('H1b: a redelivery after a transient post-write failure, with a partial refund in between, keeps Pro and cancels nothing', async () => {
  const c = await customer();
  const sub = subscription(c.workspaceId, 'pro');
  const cancels: string[] = [];
  let intent = good;
  let reads = 0;
  const deps = stripe(() => sub, `pi_${randomUUID()}`, () => intent, cancels, {
    retrieveSubscription: async () => {
      reads += 1;
      if (reads === 2) throw Object.assign(new Error('api down'), { code: 'api_error' });
      return sub;
    },
  });
  const created = event('customer.subscription.created', { id: sub.id }, T1);
  await assert.rejects(processStripeEvent(c.store, created, deps), /api down/);
  intent = partlyRefunded;
  await processStripeEvent(c.store, created, deps);
  assert.equal(await plan(c), 'pro');
  assert.deepEqual(cancels, []);
});

test('a partial refund or an open dispute before the first grant refuses the grant and cancels nothing', async () => {
  for (const [reason, intent] of [['partly_refunded', partlyRefunded], ['disputed', disputed]] as const) {
    const c = await customer();
    const sub = subscription(c.workspaceId, 'pro');
    const cancels: string[] = [];
    await processStripeEvent(c.store, event('customer.subscription.created', { id: sub.id }, T1), stripe(() => sub, `pi_${randomUUID()}`, () => intent, cancels));
    assert.equal(await plan(c), 'free', reason);
    assert.deepEqual(cancels, [], reason);
    assert.deepEqual(c.audits.filter((audit) => audit.startsWith('subscription.refused_payment')), [`subscription.refused_payment:${reason}`]);
  }
});

test('H7: a first invoice fully refunded before customer.subscription.created refuses the grant and cancels at Stripe once', async () => {
  const c = await customer();
  const sub = subscription(c.workspaceId, 'enterprise');
  const pi = `pi_${randomUUID()}`;
  const cancels: string[] = [];
  const invoice = { id: `in_${randomUUID()}`, billing_reason: 'subscription_create', parent: { subscription_details: { subscription: sub.id } }, lines: { data: [{ period: { start: PERIOD_START } }] } };
  const deps = stripe(() => sub, pi, () => fullyRefunded, cancels, { invoicesForPaymentIntent: async () => [invoice as unknown as Stripe.Invoice] });
  await processStripeEvent(c.store, fullRefundEvent(pi, String(sub.customer), T1), deps);
  await processStripeEvent(c.store, event('customer.subscription.created', { id: sub.id }, T2), deps);
  assert.equal(await plan(c), 'free');
  assert.deepEqual(cancels, [`uncode-revoke-${sub.id}`]);
});

test('H2: a refunded grant whose Stripe cancel fails loses access at once, and the next event for it (newer or the retry) cancels at Stripe', async () => {
  const c = await customer();
  const sub = subscription(c.workspaceId, 'enterprise');
  const pi = `pi_${randomUUID()}`;
  const cancels: string[] = [];
  let cancelWorks = false;
  let raced = false;
  const deps = stripe(() => sub, pi, () => fullyRefunded, cancels, {
    cancelSubscription: async (_id, key) => {
      if (!cancelWorks) throw Object.assign(new Error('stripe 500'), { code: 'api_error' });
      cancels.push(key);
    },
    // The refund lands between the grant check and the write, so its handler finds no row yet.
    retrievePaymentIntent: async (id) => {
      if (raced) return fullyRefunded(id);
      raced = true;
      await processStripeEvent(c.store, fullRefundEvent(pi, String(sub.customer), T1 + 1), stripe(() => sub, pi, () => fullyRefunded, []));
      return good(id);
    },
  });
  const created = event('customer.subscription.created', { id: sub.id }, T1);
  await assert.rejects(processStripeEvent(c.store, created, deps), /stripe 500/);
  assert.equal(await plan(c), 'free');
  cancelWorks = true;
  await processStripeEvent(c.store, event('customer.subscription.updated', { id: sub.id }, T2), deps);
  await processStripeEvent(c.store, created, deps);
  assert.equal(await plan(c), 'free');
  assert.ok(cancels.length >= 1);
  assert.ok(cancels.every((key) => key === `uncode-revoke-${sub.id}`));
});

test('A-b: a full refund of an invoice that does not pay the current period never cancels at Stripe, neither on the refund nor on a retry of the event that wrote the row', async () => {
  const c = await customer();
  const sub = subscription(c.workspaceId, 'pro');
  const renewal = `pi_${randomUUID()}`;
  const proration = `pi_${randomUUID()}`;
  const extra = periodInvoice(sub.id, PRORATION_START, 'subscription_update');
  const cancels: string[] = [];
  let latest = paidPayment(renewal, periodInvoice(sub.id, PERIOD_START));
  let intent: Intent = good;
  let reads = 0;
  let failingRead = 0;
  const deps = stripe(() => sub, renewal, () => intent, cancels, {
    invoicesForPaymentIntent: async (id) => [id === proration ? extra : periodInvoice(sub.id, PERIOD_START)],
    latestPaidInvoicePayments: async () => [latest],
    retrieveSubscription: async () => {
      reads += 1;
      if (reads === failingRead) throw Object.assign(new Error('api down'), { code: 'api_error' });
      return sub;
    },
  });
  await processStripeEvent(c.store, event('customer.subscription.created', { id: sub.id }, T1), deps);
  assert.equal(await plan(c), 'pro');
  // The proration is paid and becomes the latest paid invoice; its updated event fails after the write.
  latest = paidPayment(proration, extra);
  const updated = event('customer.subscription.updated', { id: sub.id }, T2);
  reads = 0;
  failingRead = 2;
  await assert.rejects(processStripeEvent(c.store, updated, deps), /api down/);
  failingRead = 0;
  // Support refunds the whole proration: like any refund of another period, access stays.
  intent = (id) => (id === proration ? paymentIntent(id, { amount: 20_000, amount_refunded: 20_000, refunded: true }) : good(id));
  await processStripeEvent(c.store, event('charge.refunded', { id: `ch_${randomUUID()}`, object: 'charge', amount: 20_000, amount_refunded: 20_000, refunded: true, currency: 'usd', payment_intent: proration, customer: String(sub.customer) }, T3), deps);
  assert.equal(await plan(c), 'pro');
  assert.deepEqual(cancels, []);
  // Stripe retries the failed event: still Pro, still no cancel.
  await processStripeEvent(c.store, updated, deps);
  assert.equal(await plan(c), 'pro');
  assert.deepEqual(cancels, []);
});

test('A-b: a grant whose latest paid invoice is a fully refunded proration is refused but cancels nothing at Stripe', async () => {
  const c = await customer();
  const sub = subscription(c.workspaceId, 'enterprise');
  const pi = `pi_${randomUUID()}`;
  const cancels: string[] = [];
  const deps = stripe(() => sub, pi, () => fullyRefunded, cancels, { latestPaidInvoicePayments: async () => [paidPayment(pi, periodInvoice(sub.id, PRORATION_START, 'subscription_update'))] });
  await processStripeEvent(c.store, event('customer.subscription.created', { id: sub.id }, T1), deps);
  assert.equal(await plan(c), 'free');
  assert.deepEqual(cancels, []);
  assert.deepEqual(c.audits.filter((audit) => audit.startsWith('subscription.refused_payment')), ['subscription.refused_payment:refunded']);
});

test('A-b: a fully refunded payment whose invoice was not expanded fails the event and cancels nothing, rather than guess the period', async () => {
  const c = await customer();
  const sub = subscription(c.workspaceId, 'enterprise');
  const pi = `pi_${randomUUID()}`;
  const cancels: string[] = [];
  const unexpanded = { payment: { type: 'payment_intent', payment_intent: pi }, invoice: `in_${randomUUID()}` } as Stripe.InvoicePayment;
  const deps = stripe(() => sub, pi, () => fullyRefunded, cancels, { latestPaidInvoicePayments: async () => [unexpanded] });
  await assert.rejects(processStripeEvent(c.store, event('customer.subscription.created', { id: sub.id }, T1), deps), /invoice expanded/);
  assert.equal(await plan(c), 'free');
  assert.deepEqual(cancels, []);
});

test('F3, F5: a charge refunded up to its whole amount counts as a full refund even without the refunded flag; a $0 charge never does', async () => {
  const cases: ReadonlyArray<[string, Intent, string, number]> = [
    ['amount_refunded equal to amount, refunded flag unset', (id) => paymentIntent(id, { amount_refunded: 500_000, refunded: false }), 'free', 1],
    ['a $0 charge, nothing refunded', (id) => paymentIntent(id, { amount: 0, amount_refunded: 0 }), 'pro', 0],
  ];
  for (const [label, intent, expected, cancelCount] of cases) {
    const c = await customer();
    const sub = subscription(c.workspaceId, 'pro');
    const cancels: string[] = [];
    await processStripeEvent(c.store, event('customer.subscription.created', { id: sub.id }, T1), stripe(() => sub, `pi_${randomUUID()}`, () => intent, cancels));
    assert.equal(await plan(c), expected, label);
    assert.equal(cancels.length, cancelCount, label);
  }
});
