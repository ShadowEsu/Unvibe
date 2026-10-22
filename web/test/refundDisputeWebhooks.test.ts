import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type Stripe from 'stripe';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';
import type { StripeWebhookDependencies } from '../src/billing/webhooks';
import { processStripeEvent } from '../src/billing/webhooks';

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';

type Audit = { action: string; workspaceId: string | null; metadata: Record<string, unknown> };

/** A memory store whose audit rows the test can read, and one active monthly Pro subscription. */
async function proCustomer(interval: 'monthly' | 'lifetime' = 'monthly') {
  const store = new MemoryBillingStore();
  const audits: Audit[] = [];
  const record = store.recordAudit.bind(store);
  store.recordAudit = async (userId, workspaceId, action, metadata = {}) => {
    audits.push({ action, workspaceId, metadata });
    return record(userId, workspaceId, action, metadata);
  };
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const paymentIntent = `pi_${randomUUID()}`;
  const subscriptionId = interval === 'lifetime' ? paymentIntent : `sub_${randomUUID()}`;
  const customer = `cus_${randomUUID()}`;
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval, status: 'active', seats: 1,
    stripeCustomerId: customer, stripeSubscriptionId: subscriptionId, stripePriceId: 'price_pro_monthly', cancelAtPeriodEnd: false,
  });
  return { store, audits, userId, workspaceId: workspace.id, paymentIntent, subscriptionId, customer };
}

/** Stripe as the handlers see it: live subscription status, invoice payments, and cancels. */
function fakeStripe(links: Record<string, string>, statuses: Record<string, Stripe.Subscription.Status> = {}) {
  const cancels: string[] = [];
  const deps: Required<StripeWebhookDependencies> = {
    retrieveSubscription: async (id) => ({ id, status: statuses[id] ?? 'active' }) as unknown as Stripe.Subscription,
    retrieveCheckoutSession: async () => { throw new Error('not used'); },
    invoicesForPaymentIntent: async (paymentIntent) => (links[paymentIntent]
      ? [{ id: `in_${randomUUID()}`, parent: { subscription_details: { subscription: links[paymentIntent] } } } as unknown as Stripe.Invoice]
      : []),
    cancelSubscription: async (id) => { cancels.push(id); statuses[id] = 'canceled'; },
  };
  return { deps, cancels };
}

function chargeRefunded(paymentIntent: string, customer: string, amount: number, refunded: number): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'charge.refunded',
    data: { object: { id: `ch_${randomUUID()}`, object: 'charge', amount, amount_refunded: refunded, refunded: refunded >= amount, currency: 'usd', payment_intent: paymentIntent, customer } },
  } as unknown as Stripe.Event;
}

function dispute(type: 'charge.dispute.created' | 'charge.dispute.closed', paymentIntent: string, status: Stripe.Dispute.Status, disputeId = `dp_${randomUUID()}`): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type,
    data: { object: { id: disputeId, object: 'dispute', amount: 1000, currency: 'usd', reason: 'fraudulent', status, charge: `ch_${randomUUID()}`, payment_intent: paymentIntent, evidence_details: { due_by: 1_793_000_000 } } },
  } as unknown as Stripe.Event;
}

test('a full refund of a Pro charge cancels the subscription now and the account is Free', async () => {
  const c = await proCustomer();
  const stripe = fakeStripe({ [c.paymentIntent]: c.subscriptionId });
  await processStripeEvent(c.store, chargeRefunded(c.paymentIntent, c.customer, 1000, 1000), stripe.deps);
  assert.deepEqual(stripe.cancels, [c.subscriptionId]);
  await processStripeEvent(c.store, { id: `evt_${randomUUID()}`, type: 'customer.subscription.deleted', data: { object: { id: c.subscriptionId } } } as unknown as Stripe.Event, stripe.deps);
  assert.equal((await c.store.overview(c.userId)).subscription.plan, 'free');
  const row = c.audits.find((a) => a.action === 'refund.full');
  assert.equal(row?.workspaceId, c.workspaceId);
  assert.equal(row?.metadata.stripeSubscriptionId, c.subscriptionId);
});

test('a partial refund keeps Pro and is audited', async () => {
  const c = await proCustomer();
  const stripe = fakeStripe({ [c.paymentIntent]: c.subscriptionId });
  await processStripeEvent(c.store, chargeRefunded(c.paymentIntent, c.customer, 1000, 400), stripe.deps);
  assert.deepEqual(stripe.cancels, []);
  assert.equal((await c.store.overview(c.userId)).subscription.plan, 'pro');
  assert.equal(c.audits.find((a) => a.action === 'refund.partial')?.metadata.amountRefunded, 400);
});

test('a refund with no invoice link falls back to the customer\'s one subscription', async () => {
  const c = await proCustomer();
  const stripe = fakeStripe({});
  await processStripeEvent(c.store, chargeRefunded(c.paymentIntent, c.customer, 1000, 1000), stripe.deps);
  assert.deepEqual(stripe.cancels, [c.subscriptionId]);
});

test('a refund of a charge with no subscription (a one-off) is audited and does not fail', async () => {
  const c = await proCustomer();
  const stripe = fakeStripe({});
  await processStripeEvent(c.store, chargeRefunded(`pi_${randomUUID()}`, `cus_${randomUUID()}`, 500, 500), stripe.deps);
  assert.deepEqual(stripe.cancels, []);
  assert.equal(c.audits.find((a) => a.action === 'refund.full')?.metadata.stripeSubscriptionId, null);
  assert.equal((await c.store.overview(c.userId)).subscription.plan, 'pro');
});

test('a full refund of a subscription Stripe already canceled does not cancel it again', async () => {
  const c = await proCustomer();
  const stripe = fakeStripe({ [c.paymentIntent]: c.subscriptionId }, { [c.subscriptionId]: 'canceled' });
  await processStripeEvent(c.store, chargeRefunded(c.paymentIntent, c.customer, 1000, 1000), stripe.deps);
  assert.deepEqual(stripe.cancels, []);
  assert.equal((await c.store.overview(c.userId)).subscription.plan, 'free');
});

test('a full refund of a Lifetime payment revokes Lifetime', async () => {
  const c = await proCustomer('lifetime');
  const stripe = fakeStripe({});
  await processStripeEvent(c.store, chargeRefunded(c.paymentIntent, c.customer, 8000, 8000), stripe.deps);
  assert.deepEqual(stripe.cancels, [], 'a one-time payment has no Stripe subscription to cancel');
  assert.equal((await c.store.overview(c.userId)).subscription.plan, 'free');
});

test('an opened dispute keeps access and records the evidence deadline; a lost dispute cancels', async () => {
  const c = await proCustomer();
  const stripe = fakeStripe({ [c.paymentIntent]: c.subscriptionId });
  const disputeId = `dp_${randomUUID()}`;
  await processStripeEvent(c.store, dispute('charge.dispute.created', c.paymentIntent, 'needs_response', disputeId), stripe.deps);
  assert.equal((await c.store.overview(c.userId)).subscription.plan, 'pro');
  const opened = c.audits.find((a) => a.action === 'dispute.opened');
  assert.equal(opened?.workspaceId, c.workspaceId);
  assert.equal(opened?.metadata.dueBy, new Date(1_793_000_000 * 1000).toISOString());
  assert.deepEqual(stripe.cancels, []);

  await processStripeEvent(c.store, dispute('charge.dispute.closed', c.paymentIntent, 'lost', disputeId), stripe.deps);
  assert.deepEqual(stripe.cancels, [c.subscriptionId]);
  assert.equal((await c.store.overview(c.userId)).subscription.plan, 'free');
});

test('a won dispute keeps access', async () => {
  const c = await proCustomer();
  const stripe = fakeStripe({ [c.paymentIntent]: c.subscriptionId });
  await processStripeEvent(c.store, dispute('charge.dispute.closed', c.paymentIntent, 'won'), stripe.deps);
  assert.deepEqual(stripe.cancels, []);
  assert.equal((await c.store.overview(c.userId)).subscription.plan, 'pro');
  assert.equal(c.audits.find((a) => a.action === 'dispute.closed')?.metadata.status, 'won');
});

test('the signed webhook links the charge through Invoice Payments and a replay never cancels twice', async () => {
  const store = getBillingStore();
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const subscriptionId = `sub_${randomUUID()}`;
  const paymentIntent = `pi_${randomUUID()}`;
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: subscriptionId, stripePriceId: 'price_pro_monthly', cancelAtPeriodEnd: false,
  });
  const stripe = getStripe();
  const listed: unknown[] = [];
  const cancels: string[] = [];
  stripe.invoicePayments.list = (async (params: Stripe.InvoicePaymentListParams) => {
    listed.push(params);
    return { data: [{ invoice: { id: 'in_1', parent: { subscription_details: { subscription: subscriptionId } } } }] };
  }) as unknown as typeof stripe.invoicePayments.list;
  stripe.subscriptions.retrieve = (async (id: string) => ({ id, status: cancels.includes(id) ? 'canceled' : 'active' })) as unknown as typeof stripe.subscriptions.retrieve;
  stripe.subscriptions.cancel = (async (id: string) => { cancels.push(id); return { id, status: 'canceled' }; }) as unknown as typeof stripe.subscriptions.cancel;

  const payload = JSON.stringify(chargeRefunded(paymentIntent, 'cus_x', 1000, 1000));
  const post = () => webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' }) },
    body: payload,
  }));
  const first = await post();
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { received: true });
  assert.deepEqual(listed, [{ payment: { type: 'payment_intent', payment_intent: paymentIntent }, expand: ['data.invoice'] }]);
  assert.deepEqual(cancels, [subscriptionId]);
  const replay = await post();
  assert.deepEqual(await replay.json(), { received: true, duplicate: true });
  assert.deepEqual(cancels, [subscriptionId]);
});
