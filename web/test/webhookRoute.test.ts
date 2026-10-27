import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import Stripe from 'stripe';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';

// Real route + memory store. Test-mode key; the Stripe client's methods a test needs are replaced
// on the cached client, so no request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnlyNeverSent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_BUSINESS_LIFETIME = 'price_business_lifetime';

function post(event: { id: string; type: string; livemode?: boolean; data?: { object: Record<string, unknown> } }): Promise<Response> {
  const payload = JSON.stringify({ object: 'event', livemode: false, data: { object: { id: 'cus_ignored', object: 'customer' } }, ...event });
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
  stripe.invoicePayments.list = (async () => ({ data: [] })) as unknown as typeof stripe.invoicePayments.list;
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

test('a live-mode event reaching a test-key deployment is acknowledged and never applied', async () => {
  const store = getBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  getStripe().subscriptions.retrieve = activeProSubscription(workspace.id);
  const object = { id: `sub_${randomUUID()}`, object: 'subscription' };
  const response = await post({ id: `evt_${randomUUID()}`, type: 'customer.subscription.created', livemode: true, data: { object } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ignored: 'livemode_mismatch' });
  assert.equal((await store.subscriptionByWorkspaceId(workspace.id))?.plan ?? 'free', 'free');
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

test('GAP-M12: a delivery signed with any other secret is refused 400 invalid_signature and grants nothing', async () => {
  const store = getBillingStore();
  const stripe = getStripe();
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  // Were it applied, this event would grant Pro: Stripe's read is an active Pro subscription and no invoice was paid yet.
  stripe.subscriptions.retrieve = activeProSubscription(workspace.id);
  stripe.invoices.list = (async () => ({ data: [] })) as unknown as typeof stripe.invoices.list;
  const payload = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', type: 'customer.subscription.updated', livemode: false, data: { object: { id: `sub_${randomUUID()}`, object: 'subscription' } } });
  const forged = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_attacker_guess' });
  const response = await webhook(new Request('http://localhost/api/v1/billing/webhook', { method: 'POST', headers: { 'stripe-signature': forged }, body: payload }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_signature' });
  assert.equal((await store.overview(userId)).subscription.plan, 'free');
});

/**
 * A signed Big Business checkout.session.completed through the real route, with the new tiers on.
 * Stripe's PaymentIntent read returns `latest_charge` as an object only when the route expands it.
 */
function signedBusinessCheckout(workspaceId: string, userId: string, intent: (id: string) => Stripe.PaymentIntent) {
  const stripe = getStripe();
  const session = {
    id: `cs_test_${randomUUID()}`, object: 'checkout.session', mode: 'payment', payment_status: 'paid',
    metadata: { workspace_id: workspaceId, user_id: userId, plan: 'business', interval: 'lifetime' },
    line_items: { data: [{ price: { id: 'price_business_lifetime' } }] },
    customer: `cus_${randomUUID()}`, payment_intent: `pi_${randomUUID()}`,
  };
  stripe.checkout.sessions.retrieve = (async () => session) as unknown as typeof stripe.checkout.sessions.retrieve;
  stripe.paymentIntents.retrieve = (async (id: string, params?: Stripe.PaymentIntentRetrieveParams) => {
    const read = intent(id);
    return params?.expand?.includes('latest_charge') ? read : { ...read, latest_charge: `ch_${id}` };
  }) as unknown as typeof stripe.paymentIntents.retrieve;
  const payload = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', type: 'checkout.session.completed', livemode: false, created: 1_797_000_100, data: { object: session } });
  return async () => {
    const saved = process.env.BILLING_NEW_TIERS_ENABLED;
    const original = console.error;
    process.env.BILLING_NEW_TIERS_ENABLED = 'true';
    console.error = () => undefined;
    try {
      return await webhook(new Request('http://localhost/api/v1/billing/webhook', { method: 'POST', headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' }) }, body: payload }));
    } finally {
      console.error = original;
      if (saved === undefined) delete process.env.BILLING_NEW_TIERS_ENABLED; else process.env.BILLING_NEW_TIERS_ENABLED = saved;
    }
  };
}

function intentRead(id: string, charge: Partial<Stripe.Charge> = {}): Stripe.PaymentIntent {
  return { id, object: 'payment_intent', status: 'succeeded', latest_charge: { id: `ch_${id}`, object: 'charge', amount: 500_000, amount_refunded: 0, refunded: false, disputed: false, ...charge } } as unknown as Stripe.PaymentIntent;
}

test('N3 (D14/D22): Stripe down at the PaymentIntent read is a 500 and Free; the redelivery after recovery grants Big Business', async () => {
  const store = getBillingStore();
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  let down = true;
  const send = signedBusinessCheckout(workspace.id, userId, (id) => {
    if (down) throw new Stripe.errors.StripeAPIError({ message: 'api down', type: 'api_error' });
    return intentRead(id);
  });
  assert.equal((await send()).status, 500);
  assert.equal((await store.overview(userId)).subscription.plan, 'free');
  down = false;
  assert.equal((await send()).status, 200);
  assert.equal((await store.overview(userId)).subscription.plan, 'business');
});

test('N3 (D23): the route expands latest_charge, so a refunded payment is seen and refused (200, Free)', async () => {
  const store = getBillingStore();
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const send = signedBusinessCheckout(workspace.id, userId, (id) => intentRead(id, { refunded: true, amount_refunded: 500_000 }));
  assert.equal((await send()).status, 200);
  assert.equal((await store.overview(userId)).subscription.plan, 'free');
});

test('A-b: the route hands the grant check the latest paid invoice itself: a fully refunded proration refuses the grant and cancels nothing; a refunded current-period invoice cancels once', async () => {
  const stripe = getStripe();
  const cases = [['subscription_update', 1_797_400_000, 0], ['subscription_create', 1_797_321_600, 1]] as const;
  for (const [billingReason, periodStart, cancelCount] of cases) {
    const store = getBillingStore();
    const userId = randomUUID();
    const workspace = await store.ensurePersonalWorkspace(userId);
    const subscriptionId = `sub_${randomUUID()}`;
    const customer = `cus_${randomUUID()}`;
    const paymentIntent = `pi_${randomUUID()}`;
    const cancels: unknown[] = [];
    stripe.subscriptions.retrieve = (async (id: string) => ({
      id, status: 'active', customer, cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
      metadata: { workspace_id: workspace.id, plan: 'pro', interval: 'monthly' },
      items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
    })) as unknown as typeof stripe.subscriptions.retrieve;
    stripe.invoices.list = (async () => ({
      data: [{ id: `in_${randomUUID()}`, object: 'invoice', status: 'paid', billing_reason: billingReason, parent: { subscription_details: { subscription: subscriptionId } }, lines: { data: [{ period: { start: periodStart } }] } }],
    })) as unknown as typeof stripe.invoices.list;
    stripe.invoicePayments.list = (async () => ({ data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: paymentIntent } }] })) as unknown as typeof stripe.invoicePayments.list;
    stripe.paymentIntents.retrieve = (async (id: string) => ({
      id, object: 'payment_intent', status: 'succeeded',
      latest_charge: { id: `ch_${id}`, object: 'charge', amount: 20_000, amount_refunded: 20_000, refunded: true, disputed: false },
    })) as unknown as typeof stripe.paymentIntents.retrieve;
    stripe.subscriptions.cancel = (async (id: string, _params: unknown, options: Stripe.RequestOptions) => {
      cancels.push(options.idempotencyKey);
      return { id, status: 'canceled' };
    }) as unknown as typeof stripe.subscriptions.cancel;
    const response = await post({ id: `evt_${randomUUID()}`, type: 'customer.subscription.created', data: { object: { id: subscriptionId, object: 'subscription' } } });
    assert.equal(response.status, 200, billingReason);
    assert.equal((await store.overview(userId)).subscription.plan, 'free', billingReason);
    assert.deepEqual(cancels, Array.from({ length: cancelCount }, () => `uncode-revoke-${subscriptionId}`), billingReason);
  }
});
