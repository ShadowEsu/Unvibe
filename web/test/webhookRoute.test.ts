import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type Stripe from 'stripe';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';

// Real route + memory store. Test-mode key; the Stripe client's methods a test needs are replaced
// on the cached client, so no request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';

function post(event: { id: string; type: string; data?: { object: Record<string, unknown> } }): Promise<Response> {
  const payload = JSON.stringify({ object: 'event', data: { object: { id: 'cus_ignored', object: 'customer' } }, ...event });
  return webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': getStripe().webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' }) },
    body: payload,
  }));
}

test('a delivery without the stripe-signature header is a 400, not a 503', async () => {
  const response = await webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', type: 'customer.created' }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { error: string }).error, 'missing_signature');
});

test('a delivery that arrives while the first is still processing gets 409 so Stripe retries; a completed one is a 200 duplicate', async () => {
  const event = { id: `evt_${randomUUID()}`, type: 'customer.created' };
  const store = getBillingStore();
  // The first delivery holds the claim and is still running.
  await store.claimWebhook(event.id, event.type);
  const retry = await post(event);
  assert.equal(retry.status, 409, 'an in-progress claim must not be acknowledged');
  assert.equal((await retry.json() as { error: string }).error, 'webhook_in_progress');

  await store.completeWebhook(event.id);
  const replay = await post(event);
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { received: true, duplicate: true });
});

test('the signed webhook refunds the duplicate\'s latest paid invoice and cancels it now, each with a key from its id', async () => {
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const keptId = `sub_${randomUUID()}`;
  const duplicateId = `sub_${randomUUID()}`;
  const invoiceId = `in_${randomUUID()}`;
  const paymentIntent = `pi_${randomUUID()}`;
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: keptId, stripePriceId: 'price_pro_monthly', cancelAtPeriodEnd: false,
  });
  const stripe = getStripe();
  const calls: unknown[][] = [];
  const canceled = new Set<string>();
  stripe.subscriptions.retrieve = (async (id: string) => ({
    id, status: canceled.has(id) ? 'canceled' : 'active', customer: 'cus_dup', cancel_at_period_end: false, cancel_at: null,
    created: id === keptId ? 1_797_000_000 : 1_797_000_600,
    metadata: { workspace_id: workspace.id, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  })) as unknown as typeof stripe.subscriptions.retrieve;
  stripe.invoices.list = (async (params: Stripe.InvoiceListParams) => {
    calls.push(['invoices.list', params]);
    return { data: [{ id: invoiceId, status: 'paid' }] };
  }) as unknown as typeof stripe.invoices.list;
  stripe.invoicePayments.list = (async (params: Stripe.InvoicePaymentListParams) => {
    calls.push(['invoicePayments.list', params]);
    return { data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: paymentIntent } }] };
  }) as unknown as typeof stripe.invoicePayments.list;
  stripe.refunds.create = (async (params: Stripe.RefundCreateParams, options: Stripe.RequestOptions) => {
    calls.push(['refunds.create', params, options]);
    return { id: 're_dup' };
  }) as unknown as typeof stripe.refunds.create;
  stripe.subscriptions.cancel = (async (id: string, params: unknown, options: Stripe.RequestOptions) => {
    calls.push(['subscriptions.cancel', id, params, options]);
    canceled.add(id);
    return { id, status: 'canceled' };
  }) as unknown as typeof stripe.subscriptions.cancel;
  const original = console.error;
  console.error = () => undefined;
  try {
    const response = await post({ id: `evt_${randomUUID()}`, type: 'customer.subscription.created', data: { object: { id: duplicateId, object: 'subscription' } } });
    assert.equal(response.status, 200);
  } finally {
    console.error = original;
  }
  assert.deepEqual(calls, [
    ['invoices.list', { subscription: duplicateId, status: 'paid', limit: 1 }],
    ['invoicePayments.list', { invoice: invoiceId, status: 'paid' }],
    ['refunds.create', { payment_intent: paymentIntent }, { idempotencyKey: `uncode-dup-refund-${duplicateId}-${paymentIntent}` }],
    ['subscriptions.cancel', duplicateId, undefined, { idempotencyKey: `uncode-dup-cancel-${duplicateId}` }],
  ]);
  assert.equal((await store.subscriptionByWorkspaceId(workspace.id))?.stripeSubscriptionId, keptId);
});
