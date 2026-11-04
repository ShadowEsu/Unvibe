import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import Stripe from 'stripe';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { getBillingStore } from '../src/billing/store';
import { getStripe, paymentsLocked } from '../src/billing/stripe';

// Real route + memory store. Test-mode key; the Stripe client's methods a test needs are replaced
// on the cached client, so no request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnlyNeverSent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_localonly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';

function post(event: { id: string; type: string; livemode?: boolean; data?: { object: Record<string, unknown> } }): Promise<Response> {
  const payload = JSON.stringify({ object: 'event', livemode: false, data: { object: { id: 'cus_ignored', object: 'customer' } }, ...event });
  return webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': getStripe().webhooks.generateTestHeaderString({ payload, secret: 'whsec_localonly' }) },
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

test('a webhook secret without a Stripe key is a 503, not an unhandled 500', async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    const response = await webhook(new Request('http://localhost/api/v1/billing/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=abc' },
      body: '{}',
    }));
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { error: string }).error, 'webhook_not_configured');
  } finally {
    process.env.STRIPE_SECRET_KEY = key;
  }
});

// Production with a test key and BILLING_TEST_CHECKOUT_IN_PRODUCTION unset: payments are locked.
async function onLockedProduction<T>(run: () => Promise<T>): Promise<T> {
  const env = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  delete process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION;
  try {
    return await run();
  } finally {
    if (env === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = env;
  }
}

function activeProSubscription(workspaceId: string) {
  return (async (id: string) => ({
    id, status: 'active', customer: 'cus_locked', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
    metadata: { workspace_id: workspaceId, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  })) as unknown as Stripe['subscriptions']['retrieve'];
}

test('while payments are locked, a signed event that would grant Pro is acknowledged and changes nothing', async () => {
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  getStripe().subscriptions.retrieve = activeProSubscription(workspace.id);
  const planNow = async () => (await store.subscriptionByWorkspaceId(workspace.id))?.plan ?? 'free';
  await onLockedProduction(async () => {
    // Unlocked, this exact event makes the workspace Pro (the subscription Stripe returns is active).
    const created = await post({ id: `evt_${randomUUID()}`, type: 'customer.subscription.created', data: { object: { id: `sub_${randomUUID()}`, object: 'subscription' } } });
    assert.equal(created.status, 200);
    assert.deepEqual(await created.json(), { ignored: 'payments_locked' });
    assert.equal(await planNow(), 'free', 'the workspace must stay on Free');
    for (const type of ['customer.subscription.updated', 'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'invoice.paid']) {
      const response = await post({ id: `evt_${randomUUID()}`, type });
      assert.equal(response.status, 200, type);
      assert.deepEqual(await response.json(), { ignored: 'payments_locked' }, type);
    }
  });
  assert.equal(await planNow(), 'free');
});

test('while payments are locked, a cancellation is still applied', async () => {
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const subscriptionId = `sub_${randomUUID()}`;
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: subscriptionId, stripePriceId: 'price_pro_monthly', cancelAtPeriodEnd: false,
  });
  await onLockedProduction(async () => {
    const response = await post({ id: `evt_${randomUUID()}`, type: 'customer.subscription.deleted', data: { object: { id: subscriptionId, object: 'subscription' } } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true });
  });
  assert.equal((await store.subscriptionByWorkspaceId(workspace.id))?.status, 'canceled');
});

test('while payments are locked, a refund is still processed', async () => {
  const stripe = getStripe();
  stripe.invoicePayments.list = (async function* () { /* no invoice payments */ }) as unknown as typeof stripe.invoicePayments.list;
  const event = {
    id: `evt_${randomUUID()}`, type: 'charge.refunded',
    data: { object: { id: `ch_${randomUUID()}`, object: 'charge', amount: 1000, amount_refunded: 1000, refunded: true, currency: 'usd', payment_intent: `pi_${randomUUID()}`, customer: `cus_${randomUUID()}` } },
  };
  await onLockedProduction(async () => {
    const response = await post(event);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { received: true });
    // Processed, not dropped: the delivery was claimed and completed, so a replay is a duplicate.
    assert.deepEqual(await (await post(event)).json(), { received: true, duplicate: true });
  });
});

// Security L5: an event whose livemode differs from the admitted key's mode is acknowledged (a 200, so
// Stripe stops retrying), logged and audited, and never claimed or processed. Both directions.
async function deliverOtherMode(livemode: boolean) {
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const stripe = getStripe();
  let retrieved = 0;
  const active = activeProSubscription(workspace.id);
  stripe.subscriptions.retrieve = (async (id: string) => { retrieved += 1; return active(id); }) as unknown as typeof stripe.subscriptions.retrieve;
  const event = { id: `evt_${randomUUID()}`, type: 'customer.subscription.created', livemode, data: { object: { id: `sub_${randomUUID()}`, object: 'subscription' } } };
  const audits: { action: string; metadata?: Record<string, unknown> }[] = [];
  const recordAudit = store.recordAudit.bind(store);
  store.recordAudit = async (userId, workspaceId, action, metadata) => { audits.push({ action, metadata }); return recordAudit(userId, workspaceId, action, metadata); };
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.join(' ')); };
  let response: Response;
  try {
    response = await post(event);
  } finally {
    console.error = original;
    store.recordAudit = recordAudit;
  }
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ignored: 'livemode_mismatch' });
  assert.equal(retrieved, 0, 'no Stripe call for an event of the other mode');
  assert.equal((await store.subscriptionByWorkspaceId(workspace.id))?.plan ?? 'free', 'free', 'nothing granted');
  assert.equal(await store.claimWebhook(event.id, event.type), 'claimed', 'never claimed, so never processed');
  const keyMode = livemode ? 'test' : 'live';
  assert.deepEqual(audits, [{ action: 'webhook.livemode_mismatch', metadata: { eventId: event.id, eventType: event.type, eventLivemode: livemode, keyMode } }]);
  assert.deepEqual(logged, [`[billing] webhook ${event.type} ${event.id} ignored: livemode ${livemode} does not match the ${keyMode} key`]);
}

test('a live-mode event reaching a test-key deployment is acknowledged, logged and audited, and never applied', async () => {
  await deliverOtherMode(true);
});

// An unlocked live deployment (Production, UNVIBE_CHECKOUT_LIVE=1), so only the livemode check stops it.
test('a test-mode event reaching an open live-key deployment is acknowledged, logged and audited, and never applied', async () => {
  const env = { key: process.env.STRIPE_SECRET_KEY, vercel: process.env.VERCEL_ENV, live: process.env.UNVIBE_CHECKOUT_LIVE };
  process.env.STRIPE_SECRET_KEY = 'rk_live_fake';
  process.env.VERCEL_ENV = 'production';
  process.env.UNVIBE_CHECKOUT_LIVE = '1';
  try {
    assert.equal(paymentsLocked(), false, 'purchases are open');
    await deliverOtherMode(false);
  } finally {
    process.env.STRIPE_SECRET_KEY = env.key;
    if (env.vercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = env.vercel;
    if (env.live === undefined) delete process.env.UNVIBE_CHECKOUT_LIVE;
    else process.env.UNVIBE_CHECKOUT_LIVE = env.live;
  }
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

test('Stripe\'s in-flight idempotency conflict (409 idempotency_key_in_use) answers 409 webhook_in_progress and releases the claim', async () => {
  const store = getBillingStore();
  const stripe = getStripe();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `sub_${randomUUID()}`, stripePriceId: 'price_pro_monthly', cancelAtPeriodEnd: false,
  });
  stripe.subscriptions.retrieve = (async () => {
    // The body Stripe sent in the sandbox, through the SDK's own error mapping (RequestSender -> generateV1Error).
    throw Stripe.errors.generateV1Error({
      type: 'invalid_request_error', code: 'idempotency_key_in_use', statusCode: 409,
      message: 'There is currently another in-progress request using this Idempotent Key (that probably means you submitted twice, and the other request is still going through): uncode-dup-refund-x. Please try again later.',
    });
  }) as unknown as typeof stripe.subscriptions.retrieve;
  const event = { id: `evt_${randomUUID()}`, type: 'customer.subscription.created', data: { object: { id: `sub_${randomUUID()}`, object: 'subscription' } } };
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.join(' ')); };
  try {
    const response = await post(event);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'webhook_in_progress' });
  } finally {
    console.error = original;
  }
  assert.deepEqual(logged, [`[billing] webhook customer.subscription.created ${event.id} failed: StripeAPIError invalid_request_error idempotency_key_in_use`]);
  assert.equal(await store.claimWebhook(event.id, event.type), 'claimed', 'the claim was released, so Stripe\'s retry runs it');
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
  stripe.invoicePayments.list = (async function* (params: Stripe.InvoicePaymentListParams) {
    calls.push(['invoicePayments.list', params]);
    yield { status: 'paid', payment: { type: 'payment_intent', payment_intent: paymentIntent } };
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

test('a failed delivery stores only the Stripe error type and code as last_error, never Stripe\'s message', async () => {
  const store = getBillingStore();
  const stripe = getStripe();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  stripe.subscriptions.retrieve = (async () => {
    throw new Stripe.errors.StripeInvalidRequestError({
      message: `No such subscription for cus_PrivateCustomer123 on price_live_abc (workspace ${workspace.id})`, type: 'invalid_request_error', code: 'resource_missing',
    });
  }) as unknown as typeof stripe.subscriptions.retrieve;
  const stored: string[] = [];
  const failWebhook = store.failWebhook.bind(store);
  store.failWebhook = async (eventId, message) => { stored.push(message); return failWebhook(eventId, message); };
  try {
    const response = await post({ id: `evt_${randomUUID()}`, type: 'customer.subscription.created', data: { object: { id: `sub_${randomUUID()}`, object: 'subscription' } } });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'processing_failed' });
  } finally {
    store.failWebhook = failWebhook;
  }
  assert.deepEqual(stored, ['StripeInvalidRequestError invalid_request_error resource_missing']);
});

// Security MUST-J1: Jaymini sells on the same Stripe account, so its events reach this endpoint. Its
// subscriptions carry workspace_id + plan and no interval, which today throws in requiredMetadata and
// answers 500, so Stripe retries each one for 3 days. Another product's object is acknowledged instead.
async function deliverWatched(event: Parameters<typeof post>[0], retrieve: Stripe['subscriptions']['retrieve']) {
  const store = getBillingStore();
  const stripe = getStripe();
  let retrieved = 0;
  stripe.subscriptions.retrieve = (async (id: string) => { retrieved += 1; return retrieve(id); }) as unknown as typeof stripe.subscriptions.retrieve;
  const audits: string[] = [];
  const failed: string[] = [];
  const recordAudit = store.recordAudit.bind(store);
  const failWebhook = store.failWebhook.bind(store);
  store.recordAudit = async (userId, workspaceId, action, metadata) => { audits.push(action); return recordAudit(userId, workspaceId, action, metadata); };
  store.failWebhook = async (eventId, message) => { failed.push(message); return failWebhook(eventId, message); };
  const original = console.error;
  console.error = () => undefined;
  try {
    const response = await post(event);
    return { status: response.status, body: await response.json() as Record<string, unknown>, retrieved, audits, failed };
  } finally {
    console.error = original;
    store.recordAudit = recordAudit;
    store.failWebhook = failWebhook;
  }
}

function jayminiSubscription(workspaceId: string, product: string | null) {
  return (async (id: string) => ({
    id, status: 'active', customer: 'cus_jaymini', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
    metadata: { workspace_id: workspaceId, plan: 'pro', ...(product ? { product } : {}) },
    items: { data: [{ quantity: 1, price: { id: 'price_jaymini_pro' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  })) as unknown as Stripe['subscriptions']['retrieve'];
}

test('a product=jaymini subscription.updated is a 200 other_product: never claimed, no Stripe call, no write, no failWebhook', async () => {
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const subscriptionId = `sub_${randomUUID()}`;
  const event = { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', data: { object: { id: subscriptionId, object: 'subscription', metadata: { workspace_id: workspace.id, plan: 'pro', product: 'jaymini' } } } };
  const result = await deliverWatched(event, jayminiSubscription(workspace.id, 'jaymini'));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ignored: 'other_product' });
  assert.equal(result.retrieved, 0, 'read from the signed event: no Stripe call');
  assert.deepEqual(result.failed, [], 'no failWebhook row');
  assert.deepEqual(result.audits, ['webhook.ignored_other_product']);
  assert.equal(await store.subscriptionByProviderId(subscriptionId), null, 'nothing written for it');
  assert.equal(await store.claimWebhook(event.id, event.type), 'claimed', 'never claimed, so never processed');
});

test('a jaymini invoice.paid whose snapshot has no tag is still a 200 once the live subscription shows product=jaymini', async () => {
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const subscriptionId = `sub_${randomUUID()}`;
  const event = { id: `evt_${randomUUID()}`, type: 'invoice.paid', data: { object: { id: `in_${randomUUID()}`, object: 'invoice', parent: { type: 'subscription_details', subscription_details: { subscription: subscriptionId, metadata: null } } } } };
  const result = await deliverWatched(event, jayminiSubscription(workspace.id, 'jaymini'));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ignored: 'other_product' });
  assert.equal(result.retrieved, 1);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.audits, ['webhook.ignored_other_product']);
  assert.equal(await store.subscriptionByProviderId(subscriptionId), null);
  assert.deepEqual(await (await post(event)).json(), { received: true, duplicate: true }, 'completed, so a replay is a duplicate');
});

test('an invoice whose snapshot is tagged jaymini is a 200 other_product before any Stripe call', async () => {
  const workspace = await getBillingStore().ensurePersonalWorkspace(randomUUID());
  const event = { id: `evt_${randomUUID()}`, type: 'invoice.payment_failed', data: { object: { id: `in_${randomUUID()}`, object: 'invoice', parent: { type: 'subscription_details', subscription_details: { subscription: `sub_${randomUUID()}`, metadata: { product: 'jaymini' } } } } } };
  const result = await deliverWatched(event, jayminiSubscription(workspace.id, 'jaymini'));
  assert.deepEqual([result.status, result.body, result.retrieved, result.failed], [200, { ignored: 'other_product' }, 0, []]);
});

test('controls: a product=unvibe subscription is applied, and an untagged one with incomplete metadata still fails loudly', async () => {
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const tagged = (async (id: string) => ({
    ...(await activeProSubscription(workspace.id)(id)),
    metadata: { product: 'unvibe', workspace_id: workspace.id, plan: 'pro', interval: 'monthly' },
  })) as unknown as Stripe['subscriptions']['retrieve'];
  const subscriptionId = `sub_${randomUUID()}`;
  const ours = await deliverWatched({ id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', data: { object: { id: subscriptionId, object: 'subscription', metadata: { product: 'unvibe' } } } }, tagged);
  assert.equal(ours.status, 200);
  assert.deepEqual(ours.body, { received: true });
  assert.equal((await store.subscriptionByWorkspaceId(workspace.id))?.plan, 'pro', 'Unvibe\'s own subscription grants Pro');
  assert.deepEqual(ours.failed, []);
  const other = await store.ensurePersonalWorkspace(randomUUID());
  const untagged = await deliverWatched({ id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', data: { object: { id: `sub_${randomUUID()}`, object: 'subscription' } } }, jayminiSubscription(other.id, null));
  assert.equal(untagged.status, 500, 'an untagged object with incomplete metadata keeps today\'s loud failure');
  assert.equal(untagged.failed.length, 1);
});
