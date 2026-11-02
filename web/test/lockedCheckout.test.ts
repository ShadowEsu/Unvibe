import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type Stripe from 'stripe';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { getBillingStore } from '../src/billing/store';
import { getStripe, paymentsLocked } from '../src/billing/stripe';
import { processStripeEvent } from '../src/billing/webhooks';
import { getStore } from '../src/data/store';

// Real checkout and webhook routes on the memory stores, test-mode key. A session is opened while
// purchases are open; the lock then goes back on (VERCEL_ENV=production without the test-checkout
// override) before the session is paid. Every Stripe method reached is replaced and counted.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION;
delete process.env.UNVIBE_CHECKOUT_LIVE;
delete process.env.APP_URL;
delete process.env.PUBLIC_APP_URL;
// A made-up key, short enough that the secret scan of added lines does not mistake it for a real one.
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnly';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_localonly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual';

const stripe = getStripe();
const canceled = new Set<string>();
const refundKeys: string[] = [];
const cancelKeys: string[] = [];
let workspaceForSubscriptions = '';
const checkoutParams: Stripe.Checkout.SessionCreateParams[] = [];

stripe.checkout.sessions.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
  checkoutParams.push(params);
  const id = `cs_test_${randomUUID()}`;
  return { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', expires_at: params.expires_at };
}) as unknown as typeof stripe.checkout.sessions.create;
stripe.subscriptions.retrieve = (async (id: string) => ({
  id, status: canceled.has(id) ? 'canceled' : 'active', customer: 'cus_relock', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
  metadata: { workspace_id: workspaceForSubscriptions, plan: 'pro', interval: 'monthly' },
  items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
})) as unknown as typeof stripe.subscriptions.retrieve;
stripe.invoices.list = (async (params: Stripe.InvoiceListParams) => ({ data: [{ id: `in_${params.subscription}`, status: 'paid' }] })) as unknown as typeof stripe.invoices.list;
stripe.invoicePayments.list = (async function* (params: Stripe.InvoicePaymentListParams) {
  yield { status: 'paid', payment: { type: 'payment_intent', payment_intent: `pi_${params.invoice}` } };
}) as unknown as typeof stripe.invoicePayments.list;
stripe.refunds.create = (async (_params: Stripe.RefundCreateParams, options: Stripe.RequestOptions) => {
  refundKeys.push(String(options.idempotencyKey));
  return { id: 're_relock' };
}) as unknown as typeof stripe.refunds.create;
stripe.subscriptions.cancel = (async (id: string, _params: unknown, options: Stripe.RequestOptions) => {
  cancelKeys.push(String(options.idempotencyKey));
  canceled.add(id);
  return { id, status: 'canceled' };
}) as unknown as typeof stripe.subscriptions.cancel;

function deliver(event: { id?: string; type: string; data: { object: Record<string, unknown> } }): Promise<Response> {
  const payload = JSON.stringify({ object: 'event', livemode: false, id: `evt_${randomUUID()}`, ...event });
  return webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_localonly' }) },
    body: payload,
  }));
}

for (const interval of ['monthly', 'lifetime'] as const) {
  test(`Checkout ${interval} sends only the card payment method`, async () => {
    const account = await getStore().signIn(`card-${randomUUID()}@checkout.test`);
    process.env.STRIPE_PRICE_PRO_LIFETIME = 'price_pro_lifetime';
    process.env.BILLING_LIFETIME_ENABLED = 'true';
    try {
      const response = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
        method: 'POST',
        headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'pro', interval }),
      }));
      assert.equal(response.status, 201);
      assert.deepEqual(checkoutParams.at(-1)?.payment_method_types, ['card']);
    } finally {
      delete process.env.BILLING_LIFETIME_ENABLED;
      delete process.env.STRIPE_PRICE_PRO_LIFETIME;
    }
  });
}

test('a Checkout opened while purchases were open and paid after the lock went back on is refunded and canceled, and nothing is stored', async () => {
  const account = await getStore().signIn(`relock-${randomUUID()}@checkout.test`);
  const opened = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
    method: 'POST',
    headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'pro', interval: 'monthly' }),
  }));
  assert.equal(opened.status, 201, 'checkout opens while purchases are open');
  const workspace = await getBillingStore().ensurePersonalWorkspace(account.userId);
  workspaceForSubscriptions = workspace.id;
  const intent = await getBillingStore().pendingCheckout(account.userId, workspace.id);
  assert.ok(intent?.stripeCheckoutSessionId);

  process.env.VERCEL_ENV = 'production';
  try {
    assert.equal(paymentsLocked(), true, 'the lock is back on');
    const subscriptionId = `sub_${randomUUID()}`;
    const session = {
      id: intent.stripeCheckoutSessionId, object: 'checkout.session', mode: 'subscription', subscription: subscriptionId, payment_status: 'paid',
      metadata: { workspace_id: workspace.id, user_id: account.userId, plan: 'pro', interval: 'monthly', checkout_intent_id: intent.id },
    };
    const logged: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { logged.push(args.join(' ')); };
    try {
      const completed = await deliver({ type: 'checkout.session.completed', data: { object: session } });
      assert.equal(completed.status, 200);
      assert.deepEqual(await completed.json(), { received: true });
      // Its other events, and a later async-payment event for the same session, stop nothing twice.
      for (const event of [
        { type: 'customer.subscription.created', data: { object: { id: subscriptionId, object: 'subscription' } } },
        { type: 'invoice.paid', data: { object: { id: `in_${randomUUID()}`, object: 'invoice', parent: { subscription_details: { subscription: subscriptionId } } } } },
        { type: 'checkout.session.async_payment_succeeded', data: { object: session } },
      ]) {
        assert.equal((await deliver(event)).status, 200, event.type);
      }
    } finally {
      console.error = original;
    }
    assert.deepEqual(refundKeys, [`uncode-dup-refund-${subscriptionId}-pi_in_${subscriptionId}`], 'refunded exactly once');
    assert.deepEqual(cancelKeys, [`uncode-dup-cancel-${subscriptionId}`], 'canceled exactly once');
    assert.equal(logged.filter((line) => line.includes('checkout completed while payments are locked, stopped')).length, 1);
    const row = await getBillingStore().subscriptionByWorkspaceId(workspace.id);
    assert.equal(row?.stripeSubscriptionId, undefined, 'nothing stored');
    assert.equal((await getBillingStore().overview(account.userId)).subscription.plan, 'free');
    assert.equal(await getBillingStore().pendingCheckout(account.userId, workspace.id), null, 'the checkout intent is closed');

    // A completed session this deployment never opened is still only acknowledged.
    const foreign = await deliver({ type: 'checkout.session.completed', data: { object: { ...session, id: `cs_test_${randomUUID()}` } } });
    assert.deepEqual(await foreign.json(), { ignored: 'payments_locked' });
    assert.equal(refundKeys.length, 1);
  } finally {
    delete process.env.VERCEL_ENV;
  }
});

test('while locked, a completed Lifetime checkout is refunded once and stores nothing; one already on record is left alone', async () => {
  const store = new MemoryBillingStore();
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const refunds: Array<{ target: unknown; key: string }> = [];
  const deps = {
    retrieveSubscription: async () => { throw new Error('not used'); },
    refundPayment: async (target: unknown, key: string) => { refunds.push({ target, key }); return 're_lifetime'; },
  };
  const paymentIntent = `pi_${randomUUID()}`;
  const event = {
    id: `evt_${randomUUID()}`, type: 'checkout.session.completed',
    data: { object: { id: `cs_test_${randomUUID()}`, mode: 'payment', payment_status: 'paid', payment_intent: paymentIntent, metadata: { workspace_id: workspace.id, plan: 'pro', interval: 'lifetime' } } },
  } as unknown as Stripe.Event;
  const original = console.error;
  console.error = () => undefined;
  try {
    await processStripeEvent(store, event, deps, { revokeOnly: true });
    assert.deepEqual(refunds, [{ target: { payment_intent: paymentIntent }, key: `uncode-locked-refund-${paymentIntent}` }]);
    assert.equal((await store.overview(userId)).subscription.plan, 'free', 'nothing stored');

    await store.syncSubscription({
      workspaceId: workspace.id, plan: 'pro', interval: 'lifetime', status: 'active', seats: 1, stripeCustomerId: 'cus_life',
      stripeSubscriptionId: paymentIntent, stripePriceId: 'price_life', cancelAtPeriodEnd: false,
    });
    await processStripeEvent(store, event, deps, { revokeOnly: true });
    assert.equal(refunds.length, 1, 'a Lifetime grant already on record is not refunded');
  } finally {
    console.error = original;
  }
});

test('while locked, a completion for a subscription already on record with access (paid while open) refunds and cancels nothing', async () => {
  const store = new MemoryBillingStore();
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  const subscriptionId = `sub_${randomUUID()}`;
  await store.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1, stripeCustomerId: 'cus_open',
    stripeSubscriptionId: subscriptionId, stripePriceId: 'price_pro_monthly', cancelAtPeriodEnd: false,
  });
  const calls: string[] = [];
  const deps = {
    retrieveSubscription: async (id: string) => { calls.push(`retrieve:${id}`); return { id, status: 'active' } as Stripe.Subscription; },
    latestPaidInvoicePayments: async () => { calls.push('invoices'); return []; },
    refundPayment: async () => { calls.push('refund'); return 're_x'; },
    cancelSubscription: async () => { calls.push('cancel'); },
  };
  const event = {
    id: `evt_${randomUUID()}`, type: 'checkout.session.async_payment_succeeded',
    data: { object: { id: `cs_test_${randomUUID()}`, mode: 'subscription', subscription: subscriptionId, payment_status: 'paid', metadata: { workspace_id: workspace.id } } },
  } as unknown as Stripe.Event;
  await processStripeEvent(store, event, deps, { revokeOnly: true });
  assert.deepEqual(calls, []);
  assert.equal((await store.subscriptionByWorkspaceId(workspace.id))?.status, 'active');
});

test('a locked unpaid completion then paid async success refunds its own invoice once and audits once, including replay', async () => {
  const billing = getBillingStore();
  const account = await getStore().signIn(`delayed-${randomUUID()}@checkout.test`);
  const workspace = await billing.ensurePersonalWorkspace(account.userId);
  const intent = await billing.createCheckoutIntent({ userId: account.userId, workspaceId: workspace.id, plan: 'pro', interval: 'monthly', seats: 1 });
  const sessionId = `cs_test_${randomUUID()}`;
  const subscriptionId = `sub_${randomUUID()}`;
  const invoice = `in_${randomUUID()}`;
  await billing.attachCheckoutSession(intent.id, sessionId);
  const session = { id: sessionId, mode: 'subscription', subscription: subscriptionId, invoice, payment_status: 'unpaid', metadata: { workspace_id: workspace.id } };
  const originalInvoices = stripe.invoices.list;
  const originalPayments = stripe.invoicePayments.list;
  const originalAudit = billing.recordAudit.bind(billing);
  const refundsBefore = refundKeys.length;
  const cancelsBefore = cancelKeys.length;
  let paid = false;
  let audits = 0;
  let started = 0;
  stripe.invoices.list = (async () => ({ data: [] })) as unknown as typeof stripe.invoices.list;
  stripe.invoicePayments.list = (async function* (params: Stripe.InvoicePaymentListParams) {
    assert.equal(params.invoice, invoice, 'only the session invoice is eligible, not a later subscription invoice');
    if (paid) yield { payment: { payment_intent: `pi_${invoice}` } };
  }) as unknown as typeof stripe.invoicePayments.list;
  billing.recordAudit = async (...args) => {
    await originalAudit(...args);
    if (args[2] === 'checkout.stopped_while_locked') audits += 1;
    if (args[2] === 'checkout.stop_started') {
      started += 1;
      assert.deepEqual(args[3], { checkoutSessionId: sessionId, subscriptionId });
    }
  };
  process.env.VERCEL_ENV = 'production';
  try {
    assert.equal((await deliver({ type: 'checkout.session.completed', data: { object: session } })).status, 200);
    assert.ok(canceled.has(subscriptionId));
    assert.equal(refundKeys.length - refundsBefore, 0);
    assert.equal(started, 1, 'the unpaid cancel leaves its provenance before the payment settles');
    paid = true;
    const event = { id: `evt_${randomUUID()}`, type: 'checkout.session.async_payment_succeeded', data: { object: { ...session, payment_status: 'paid' } } };
    assert.equal((await deliver(event)).status, 200);
    assert.deepEqual(refundKeys.slice(refundsBefore), [`uncode-dup-refund-${subscriptionId}-pi_${invoice}`]);
    assert.equal(cancelKeys.length - cancelsBefore, 1);
    assert.equal(audits, 1);
    const replay = await deliver(event);
    assert.deepEqual(await replay.json(), { received: true, duplicate: true });
    assert.equal(refundKeys.length - refundsBefore, 1);
    assert.equal(audits, 1);
  } finally {
    delete process.env.VERCEL_ENV;
    stripe.invoices.list = originalInvoices;
    stripe.invoicePayments.list = originalPayments;
    billing.recordAudit = originalAudit;
  }
});

test('a locked paid stop retries a failed audit after cancellation and a normal stop writes one audit', async () => {
  const billing = getBillingStore();
  const originalAudit = billing.recordAudit.bind(billing);
  const originalRefund = stripe.refunds.create;
  const originalPayments = stripe.invoicePayments.list;
  const refunds = new Map<string, string>();
  stripe.refunds.create = (async (_params: unknown, options: Stripe.RequestOptions) => {
    const key = String(options.idempotencyKey);
    if (!refunds.has(key)) refunds.set(key, `re_${randomUUID()}`);
    return { id: refunds.get(key) };
  }) as unknown as typeof stripe.refunds.create;
  stripe.invoicePayments.list = (async function* (params: Stripe.InvoicePaymentListParams) {
    yield { payment: { payment_intent: `pi_${params.invoice}` } };
  }) as unknown as typeof stripe.invoicePayments.list;
  process.env.VERCEL_ENV = 'production';
  try {
    for (const failFirstAudit of [true, false]) {
      const userId = randomUUID();
      const workspace = await billing.ensurePersonalWorkspace(userId);
      const intent = await billing.createCheckoutIntent({ userId, workspaceId: workspace.id, plan: 'pro', interval: 'monthly', seats: 1 });
      const subscriptionId = `sub_${randomUUID()}`;
      const sessionId = `cs_test_${randomUUID()}`;
      await billing.attachCheckoutSession(intent.id, sessionId);
      let failAudit = failFirstAudit;
      let audits = 0;
      billing.recordAudit = async (...args) => {
        if (args[2] === 'checkout.stopped_while_locked' && failAudit) { failAudit = false; throw new Error('audit unavailable'); }
        await originalAudit(...args);
        if (args[2] === 'checkout.stopped_while_locked') audits += 1;
      };
      const event = {
        id: `evt_${randomUUID()}`, type: 'checkout.session.completed',
        data: { object: { id: sessionId, mode: 'subscription', subscription: subscriptionId, invoice: `in_${subscriptionId}`, payment_status: 'paid', metadata: { workspace_id: workspace.id } } },
      };
      const refundsBefore = refunds.size;
      assert.equal((await deliver(event)).status, failFirstAudit ? 500 : 200);
      assert.ok(canceled.has(subscriptionId), 'Stripe cancellation succeeded before any audit retry');
      assert.equal(refunds.size - refundsBefore, 1);
      assert.equal((await deliver(event)).status, 200);
      assert.equal((await billing.checkoutStopAudits(sessionId)).started, true);
      assert.equal(audits, 1, 'both retry and normal paths retain exactly one successful audit');
      assert.equal(refunds.size - refundsBefore, 1, 'the refund key is shared across the retry');
      assert.equal((await billing.checkoutStopAudits(sessionId)).finished, true);
      const replay = await deliver(event);
      assert.deepEqual(await replay.json(), { received: true, duplicate: true });
      const later = await deliver({ ...event, id: `evt_${randomUUID()}` });
      assert.equal(later.status, 200);
      assert.equal(audits, 1, 'a second event for the same paid stop does not repeat its audit');
    }
  } finally {
    delete process.env.VERCEL_ENV;
    billing.recordAudit = originalAudit;
    stripe.refunds.create = originalRefund;
    stripe.invoicePayments.list = originalPayments;
  }
});

test('a legitimate grant canceled before a lock is not refunded by a late paid checkout completion', async () => {
  const billing = getBillingStore();
  const userId = randomUUID();
  const workspace = await billing.ensurePersonalWorkspace(userId);
  workspaceForSubscriptions = workspace.id;
  const intent = await billing.createCheckoutIntent({ userId, workspaceId: workspace.id, plan: 'pro', interval: 'monthly', seats: 1 });
  const subscriptionId = `sub_${randomUUID()}`;
  const sessionId = `cs_test_${randomUUID()}`;
  await billing.attachCheckoutSession(intent.id, sessionId);
  assert.equal((await deliver({ type: 'customer.subscription.created', data: { object: { id: subscriptionId } } })).status, 200);
  assert.equal((await billing.subscriptionByProviderId(subscriptionId))?.status, 'active', 'the unlocked event granted access');
  canceled.add(subscriptionId);
  assert.equal((await deliver({ type: 'customer.subscription.deleted', data: { object: { id: subscriptionId } } })).status, 200);
  const originalAudit = billing.recordAudit.bind(billing);
  const stopAudits: string[] = [];
  billing.recordAudit = async (...args) => {
    await originalAudit(...args);
    if (args[2].startsWith('checkout.stop')) stopAudits.push(args[2]);
  };
  const refundsBefore = refundKeys.length;
  const cancelsBefore = cancelKeys.length;
  process.env.VERCEL_ENV = 'production';
  try {
    const response = await deliver({
      type: 'checkout.session.completed',
      data: { object: { id: sessionId, mode: 'subscription', subscription: subscriptionId, invoice: `in_${subscriptionId}`, payment_status: 'paid', metadata: { workspace_id: workspace.id } } },
    });
    assert.equal(response.status, 200);
    assert.equal(refundKeys.length - refundsBefore, 0, 'a legitimate canceled purchase has no locked-stop provenance');
    assert.equal(cancelKeys.length - cancelsBefore, 0);
    assert.deepEqual(stopAudits, []);
    assert.equal((await billing.subscriptionByProviderId(subscriptionId))?.status, 'canceled');
  } finally {
    delete process.env.VERCEL_ENV;
    billing.recordAudit = originalAudit;
  }
});

function lockedPaidSession(workspaceId: string, subscriptionId: string): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'checkout.session.completed',
    data: { object: { id: `cs_test_${randomUUID()}`, mode: 'subscription', subscription: subscriptionId, invoice: `in_${subscriptionId}`, payment_status: 'paid', metadata: { workspace_id: workspaceId } } },
  } as unknown as Stripe.Event;
}

test('a locked paid stop that finds no payment to refund fails without a completion row, and a retry refunds once', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  const { store, sessionId } = await storeWithIntent(event);
  let status: Stripe.Subscription.Status = 'active';
  let settled = false;
  const refunds: string[] = [];
  const deps = {
    retrieveSubscription: async (id: string) => ({ id, status }) as Stripe.Subscription,
    latestPaidInvoicePayments: async () => [],
    paidInvoicePayments: async () => (settled ? [{ payment: { payment_intent: `pi_${subscriptionId}` } } as Stripe.InvoicePayment] : []),
    refundPayment: async (_target: unknown, key: string) => { refunds.push(key); return 're_settled'; },
    cancelSubscription: async () => { status = 'canceled'; },
  };
  await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: true }), /no payment found to refund yet/);
  assert.equal(status, 'canceled', 'the subscription is still stopped');
  assert.equal((await store.checkoutStopAudits(sessionId)).finished, false);
  assert.deepEqual(refunds, []);
  assert.equal((await store.findCheckoutIntent(sessionId))?.status, 'expired', 'a retrying stop leaves no pending intent');

  settled = true;
  await processStripeEvent(store, event, deps, { revokeOnly: true });
  assert.deepEqual(refunds, [`uncode-dup-refund-${subscriptionId}-pi_${subscriptionId}`]);
  assert.equal((await store.checkoutStopAudits(sessionId)).finished, true);
  const intent = await store.findCheckoutIntent(sessionId);
  assert.equal(intent?.status, 'expired');
  await store.expireCheckoutIntent(intent!.id);
  assert.equal((await store.findCheckoutIntent(sessionId))?.status, 'expired', 'expiring again changes nothing');
});

test('a locked canceled recovery that still finds no payment to refund fails without a completion row', async () => {
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession(workspace.id, subscriptionId);
  const sessionId = (event.data.object as Stripe.Checkout.Session).id;
  await store.recordAudit(null, workspace.id, 'checkout.stop_started', { checkoutSessionId: sessionId, subscriptionId });
  const deps = {
    retrieveSubscription: async (id: string) => ({ id, status: 'canceled' }) as Stripe.Subscription,
    paidInvoicePayments: async () => [],
    refundPayment: async () => { throw new Error('nothing to refund'); },
  };
  await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: true }), /no payment found to refund yet/);
  assert.equal((await store.checkoutStopAudits(sessionId)).finished, false);
});

test('a locked stop records its start before any Stripe refund or cancel', async () => {
  const store = new MemoryBillingStore();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession(workspace.id, subscriptionId);
  const sessionId = (event.data.object as Stripe.Checkout.Session).id;
  const deps = {
    retrieveSubscription: async (id: string) => ({ id, status: 'active' }) as Stripe.Subscription,
    latestPaidInvoicePayments: async () => [{ payment: { payment_intent: `pi_${subscriptionId}` } } as Stripe.InvoicePayment],
    refundPayment: async () => { throw new Error('Stripe unavailable'); },
    cancelSubscription: async () => { throw new Error('not reached'); },
  };
  await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: true }), /Stripe unavailable/);
  assert.equal((await store.checkoutStopAudits(sessionId)).started, true);
});

test('a locked stop whose start audit cannot be written makes no Stripe call, and the retry stops it once with both rows', async () => {
  let failStart = true;
  class StartAuditFails extends MemoryBillingStore {
    override async recordAudit(userId: string | null, workspaceId: string | null, action: string, metadata?: Record<string, unknown>): Promise<void> {
      if (failStart && action === 'checkout.stop_started') throw new Error('audit store unavailable');
      await super.recordAudit(userId, workspaceId, action, metadata);
    }
  }
  const store = new StartAuditFails();
  const workspace = await store.ensurePersonalWorkspace(randomUUID());
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession(workspace.id, subscriptionId);
  const sessionId = (event.data.object as Stripe.Checkout.Session).id;
  let status: Stripe.Subscription.Status = 'active';
  const refunds: string[] = [];
  const cancels: string[] = [];
  const deps = {
    retrieveSubscription: async (id: string) => ({ id, status }) as Stripe.Subscription,
    latestPaidInvoicePayments: async () => [{ payment: { payment_intent: `pi_${subscriptionId}` } } as Stripe.InvoicePayment],
    refundPayment: async (_target: unknown, key: string) => { refunds.push(key); return 're_after_retry'; },
    cancelSubscription: async (id: string) => { cancels.push(id); status = 'canceled'; },
  };
  await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: true }), /audit store unavailable/);
  assert.deepEqual(refunds, [], 'no refund before the start is recorded');
  assert.deepEqual(cancels, [], 'no cancel before the start is recorded');

  failStart = false;
  await processStripeEvent(store, event, deps, { revokeOnly: true });
  assert.equal(refunds.length, 1);
  assert.deepEqual(cancels, [subscriptionId]);
  assert.deepEqual(await store.checkoutStopAudits(sessionId), { started: true, finished: true });
});

/** A memory store with an open checkout intent attached to the event's session, recording audit actions. */
async function storeWithIntent(event: Stripe.Event) {
  const store = new MemoryBillingStore();
  const actions: string[] = [];
  const record = store.recordAudit.bind(store);
  store.recordAudit = async (userId, workspaceId, action, metadata) => { actions.push(action); await record(userId, workspaceId, action, metadata); };
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  session.metadata = { workspace_id: workspace.id };
  const intent = await store.createCheckoutIntent({ userId, workspaceId: workspace.id, plan: 'pro', interval: 'monthly', seats: 1 });
  await store.attachCheckoutSession(intent.id, session.id);
  return { store, actions, workspaceId: workspace.id, sessionId: session.id };
}

test('a locked stop still retrying finishes after purchases reopen: one refund, the completion row, no checkout grant', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  const { store, actions, workspaceId, sessionId } = await storeWithIntent(event);
  let status: Stripe.Subscription.Status = 'active';
  let settled = false;
  const refunds: string[] = [];
  const deps = {
    retrieveSubscription: async (id: string) => ({
      id, status, customer: 'cus_reopen', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
      metadata: { workspace_id: workspaceId, plan: 'pro', interval: 'monthly' },
      items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
    }) as unknown as Stripe.Subscription,
    latestPaidInvoicePayments: async () => [],
    paidInvoicePayments: async () => (settled ? [{ payment: { payment_intent: `pi_${subscriptionId}` } } as Stripe.InvoicePayment] : []),
    refundPayment: async (_target: unknown, key: string) => { refunds.push(key); return 're_reopened'; },
    cancelSubscription: async () => { status = 'canceled'; },
  };
  await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: true }), /no payment found to refund yet/);

  settled = true;
  await processStripeEvent(store, event, deps, { revokeOnly: false });
  assert.deepEqual(refunds, [`uncode-dup-refund-${subscriptionId}-pi_${subscriptionId}`]);
  assert.equal((await store.checkoutStopAudits(sessionId)).finished, true);
  assert.equal(actions.includes('checkout.completed'), false, 'a stopped checkout is never completed');
  assert.notEqual((await store.findCheckoutIntent(sessionId))?.status, 'completed');
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.stripeSubscriptionId, undefined, 'nothing stored');
});

test('an unlocked checkout with no stop rows still completes, stores the subscription and refunds nothing', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  const { store, actions, workspaceId, sessionId } = await storeWithIntent(event);
  const refunds: string[] = [];
  const deps = {
    retrieveSubscription: async (id: string) => ({
      id, status: 'active', customer: 'cus_open', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
      metadata: { workspace_id: workspaceId, plan: 'pro', interval: 'monthly' },
      items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
    }) as unknown as Stripe.Subscription,
    refundPayment: async (_target: unknown, key: string) => { refunds.push(key); return 're_unexpected'; },
  };
  await processStripeEvent(store, event, deps, { revokeOnly: false });
  assert.deepEqual(refunds, []);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'active');
  assert.equal((await store.findCheckoutIntent(sessionId))?.status, 'completed');
  assert.deepEqual(actions, ['checkout.completed']);
  await store.expireCheckoutIntent((await store.findCheckoutIntent(sessionId))!.id);
  assert.equal((await store.findCheckoutIntent(sessionId))?.status, 'completed', 'only a pending intent is expired, as in SQL');
});

/**
 * Stripe for one Pro subscription as the handlers see it. Refunds are idempotent by key, like Stripe:
 * a reused key returns the first refund, so `refunds` holds one entry per refund actually made.
 */
function stripeFor(workspaceId: string, subscriptionId: string, options: { failFirstCancel?: boolean; failFirstRefund?: boolean } = {}) {
  const state = { status: 'active' as Stripe.Subscription.Status, cancels: 0, cancelFailures: 0, refundCalls: 0, refundFailures: 0, refunds: new Map<string, string>() };
  const subscription = (id: string) => ({
    id, status: state.status, customer: 'cus_stop', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
    metadata: { workspace_id: workspaceId, plan: 'pro', interval: 'monthly' },
    items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  }) as unknown as Stripe.Subscription;
  const payments = [{ payment: { payment_intent: `pi_${subscriptionId}` } } as Stripe.InvoicePayment];
  const deps = {
    retrieveSubscription: async (id: string) => subscription(id),
    latestPaidInvoicePayments: async () => payments,
    paidInvoicePayments: async () => payments,
    refundPayment: async (_target: unknown, key: string) => {
      state.refundCalls += 1;
      if (options.failFirstRefund && state.refundFailures === 0) { state.refundFailures += 1; throw new Error('Stripe refund unavailable'); }
      if (!state.refunds.has(key)) state.refunds.set(key, `re_${randomUUID()}`);
      return state.refunds.get(key)!;
    },
    cancelSubscription: async () => {
      if (options.failFirstCancel && state.cancelFailures === 0) { state.cancelFailures += 1; throw new Error('Stripe cancel unavailable'); }
      state.cancels += 1;
      state.status = 'canceled';
    },
  };
  return { state, deps };
}

function subscriptionEvent(type: 'customer.subscription.updated' | 'customer.subscription.deleted', subscriptionId: string): Stripe.Event {
  return { id: `evt_${randomUUID()}`, type, data: { object: { id: subscriptionId } } } as unknown as Stripe.Event;
}

test('a half-finished locked stop is finished after a reopen even when a subscription event stored it as active first', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  const { store, actions, workspaceId, sessionId } = await storeWithIntent(event);
  const { state, deps } = stripeFor(workspaceId, subscriptionId, { failFirstCancel: true });
  // Locked: the refund goes through, the cancel fails, so the event fails and Stripe retries it.
  await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: true }), /Stripe cancel unavailable/);
  assert.equal(state.refunds.size, 1);
  assert.equal(state.cancels, 0);

  // Purchases reopen, and a subscription event lands before the checkout retry.
  await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', subscriptionId), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'active', 'stored as active before the retry');

  await processStripeEvent(store, event, deps, { revokeOnly: false });
  assert.deepEqual([...state.refunds.keys()], [`uncode-dup-refund-${subscriptionId}-pi_${subscriptionId}`], 'one refund, the shared key');
  assert.equal(state.cancels, 1, 'one successful cancel');
  assert.equal((await store.checkoutStopAudits(sessionId)).finished, true);
  assert.equal(actions.includes('checkout.completed'), false);
  const userId = (await store.findCheckoutIntent(sessionId))!.userId;
  // The stop itself takes access away: no customer.subscription.deleted has arrived yet.
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'canceled', 'canceled by the finish');
  assert.equal((await store.overview(userId)).subscription.plan, 'free', 'no access before the deletion event');

  // The deletion Stripe sends after the cancel leaves it canceled.
  await processStripeEvent(store, subscriptionEvent('customer.subscription.deleted', subscriptionId), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'canceled');
  assert.equal((await store.overview(userId)).subscription.plan, 'free', 'no access at the end');
});

test('after a finished locked stop, an unlocked resend of the completion changes nothing', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  const { store, actions, workspaceId, sessionId } = await storeWithIntent(event);
  const { state, deps } = stripeFor(workspaceId, subscriptionId);
  await processStripeEvent(store, event, deps, { revokeOnly: true });
  assert.equal(state.refundCalls, 1);
  assert.equal((await store.checkoutStopAudits(sessionId)).finished, true);
  const rowsBefore = actions.length;

  await processStripeEvent(store, { ...event, id: `evt_${randomUUID()}` }, deps, { revokeOnly: false });
  assert.equal(state.refundCalls, 1, 'no new refund');
  assert.equal(state.cancels, 1);
  assert.deepEqual(actions.slice(rowsBefore), [], 'no checkout.completed and no new stop row');
  assert.equal((await store.findCheckoutIntent(sessionId))?.status, 'expired');
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.stripeSubscriptionId, undefined, 'no subscription row');
});

test('an unlocked resend of a Lifetime checkout with only a completion row grants nothing and refunds nothing', async () => {
  process.env.STRIPE_PRICE_PRO_LIFETIME = 'price_pro_lifetime';
  try {
    const paymentIntent = `pi_${randomUUID()}`;
    const event = {
      id: `evt_${randomUUID()}`, type: 'checkout.session.completed',
      data: { object: {
        id: `cs_test_${randomUUID()}`, mode: 'payment', payment_status: 'paid', payment_intent: paymentIntent, customer: 'cus_lifetime',
        line_items: { data: [{ price: { id: 'price_pro_lifetime' } }] }, metadata: { plan: 'pro', interval: 'lifetime' },
      } },
    } as unknown as Stripe.Event;
    const { store, actions, workspaceId, sessionId } = await storeWithIntent(event);
    Object.assign((event.data.object as Stripe.Checkout.Session).metadata!, { plan: 'pro', interval: 'lifetime' });
    // A stop finished by a build that wrote no start row for Lifetime.
    await store.recordAudit(null, workspaceId, 'checkout.stopped_while_locked', { checkoutSessionId: sessionId, stopped: paymentIntent, refunded: ['re_earlier'] });
    const refunds: string[] = [];
    const deps = {
      retrieveSubscription: async () => { throw new Error('not used'); },
      refundPayment: async (_target: unknown, key: string) => { refunds.push(key); return 're_again'; },
    };
    await processStripeEvent(store, event, deps, { revokeOnly: false });
    assert.deepEqual(refunds, []);
    assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.stripeSubscriptionId, undefined, 'no Lifetime grant');
    assert.deepEqual(actions, ['checkout.stopped_while_locked'], 'no checkout.completed and no second completion row');
  } finally {
    delete process.env.STRIPE_PRICE_PRO_LIFETIME;
  }
});

test('a locked Lifetime refund that fails is refunded on the retry after a reopen, not granted', async () => {
  process.env.STRIPE_PRICE_PRO_LIFETIME = 'price_pro_lifetime';
  try {
    const paymentIntent = `pi_${randomUUID()}`;
    const event = {
      id: `evt_${randomUUID()}`, type: 'checkout.session.completed',
      data: { object: {
        id: `cs_test_${randomUUID()}`, mode: 'payment', payment_status: 'paid', payment_intent: paymentIntent, customer: 'cus_lifetime',
        line_items: { data: [{ price: { id: 'price_pro_lifetime' } }] },
      } },
    } as unknown as Stripe.Event;
    const { store, actions, workspaceId, sessionId } = await storeWithIntent(event);
    Object.assign((event.data.object as Stripe.Checkout.Session).metadata!, { plan: 'pro', interval: 'lifetime' });
    const refunds = new Map<string, string>();
    let failRefund = true;
    const deps = {
      retrieveSubscription: async () => { throw new Error('not used'); },
      refundPayment: async (_target: unknown, key: string) => {
        if (failRefund) { failRefund = false; throw new Error('Stripe refund unavailable'); }
        if (!refunds.has(key)) refunds.set(key, `re_${randomUUID()}`);
        return refunds.get(key)!;
      },
    };
    await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: true }), /Stripe refund unavailable/);
    assert.equal((await store.checkoutStopAudits(sessionId)).started, true);

    await processStripeEvent(store, event, deps, { revokeOnly: false });
    assert.deepEqual([...refunds.keys()], [`uncode-locked-refund-${paymentIntent}`], 'one refund, the shared key');
    assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.stripeSubscriptionId, undefined, 'no Lifetime grant');
    assert.equal((await store.checkoutStopAudits(sessionId)).finished, true);
    assert.equal(actions.includes('checkout.completed'), false);
  } finally {
    delete process.env.STRIPE_PRICE_PRO_LIFETIME;
  }
});

test('an unlocked async payment success for a stop started while locked is stopped, not completed', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const completed = lockedPaidSession('', subscriptionId);
  const { store, actions, workspaceId, sessionId } = await storeWithIntent(completed);
  const { state, deps } = stripeFor(workspaceId, subscriptionId);
  const latest = deps.latestPaidInvoicePayments;
  deps.latestPaidInvoicePayments = async () => [];
  const unpaid = { ...completed, data: { object: { ...(completed.data.object as Stripe.Checkout.Session), payment_status: 'unpaid' } } } as Stripe.Event;
  await processStripeEvent(store, unpaid, deps, { revokeOnly: true });
  assert.equal((await store.checkoutStopAudits(sessionId)).started, true);
  deps.latestPaidInvoicePayments = latest;

  const asyncPaid = { ...completed, id: `evt_${randomUUID()}`, type: 'checkout.session.async_payment_succeeded' } as Stripe.Event;
  await processStripeEvent(store, asyncPaid, deps, { revokeOnly: false });
  assert.deepEqual([...state.refunds.keys()], [`uncode-dup-refund-${subscriptionId}-pi_${subscriptionId}`]);
  assert.equal((await store.checkoutStopAudits(sessionId)).finished, true);
  assert.equal(actions.includes('checkout.completed'), false);
  assert.notEqual((await store.findCheckoutIntent(sessionId))?.status, 'completed');
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.stripeSubscriptionId, undefined);
});

test('an unlocked resend of a stopped session that needed no payment grants nothing', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const paid = lockedPaidSession('', subscriptionId);
  const { store, actions, workspaceId, sessionId } = await storeWithIntent(paid);
  const event = { ...paid, data: { object: { ...(paid.data.object as Stripe.Checkout.Session), payment_status: 'no_payment_required' } } } as Stripe.Event;
  const { state, deps } = stripeFor(workspaceId, subscriptionId);
  deps.latestPaidInvoicePayments = async () => [];
  await processStripeEvent(store, event, deps, { revokeOnly: true });
  assert.equal(state.cancels, 1);
  assert.deepEqual(actions, ['checkout.stop_started']);

  await processStripeEvent(store, { ...event, id: `evt_${randomUUID()}` }, deps, { revokeOnly: false });
  assert.equal(state.refunds.size, 0);
  assert.deepEqual(actions, ['checkout.stop_started'], 'no checkout.completed and no other row');
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.stripeSubscriptionId, undefined, 'nothing granted');
  assert.equal((await store.findCheckoutIntent(sessionId))?.status, 'expired');
});

test('an unlocked checkout whose stop lookup fails is failed and grants nothing', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  const { store, actions, workspaceId, sessionId } = await storeWithIntent(event);
  store.checkoutStopAudits = async () => { throw new Error('audit store unavailable'); };
  const { state, deps } = stripeFor(workspaceId, subscriptionId);
  await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: false }), /audit store unavailable/);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.stripeSubscriptionId, undefined, 'no subscription row');
  assert.equal(actions.includes('checkout.completed'), false);
  assert.equal((await store.findCheckoutIntent(sessionId))?.status, 'pending');
  assert.equal(state.refundCalls + state.cancels, 0);
});

/** Counts `checkoutStopAudits` reads on a store. */
function countStopReads(store: MemoryBillingStore) {
  const counter = { reads: 0 };
  const read = store.checkoutStopAudits.bind(store);
  store.checkoutStopAudits = async (sessionId: string) => { counter.reads += 1; return read(sessionId); };
  return counter;
}

test('an unlocked checkout reads its stop rows once, whether it completes or finishes a stop', async () => {
  const openId = `sub_${randomUUID()}`;
  const open = lockedPaidSession('', openId);
  const completing = await storeWithIntent(open);
  const openReads = countStopReads(completing.store);
  await processStripeEvent(completing.store, open, stripeFor(completing.workspaceId, openId).deps, { revokeOnly: false });
  assert.equal(completing.actions.includes('checkout.completed'), true);
  assert.equal(openReads.reads, 1, 'one read on a normal checkout');

  const stoppedId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', stoppedId);
  const { store, actions, workspaceId } = await storeWithIntent(event);
  const { deps } = stripeFor(workspaceId, stoppedId, { failFirstCancel: true });
  await assert.rejects(processStripeEvent(store, event, deps, { revokeOnly: true }), /Stripe cancel unavailable/);
  const stopReads = countStopReads(store);
  await processStripeEvent(store, event, deps, { revokeOnly: false });
  assert.equal(actions.includes('checkout.stopped_while_locked'), true);
  assert.equal(stopReads.reads, 1, 'the stop reuses the routing read');
});

test('a started stop whose subscription Stripe already canceled recovers the refund and cancels the stored active row', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  const { store, actions, workspaceId, sessionId } = await storeWithIntent(event);
  const { state, deps } = stripeFor(workspaceId, subscriptionId);
  const refundKey = `uncode-dup-refund-${subscriptionId}-pi_${subscriptionId}`;
  // An earlier delivery started the stop, refunded and canceled in Stripe, then failed before its row.
  await store.recordAudit(null, workspaceId, 'checkout.stop_started', { checkoutSessionId: sessionId, subscriptionId });
  state.refunds.set(refundKey, 're_first');
  // A subscription event stored it as active before Stripe showed the cancel.
  await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', subscriptionId), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'active');
  state.status = 'canceled';

  await processStripeEvent(store, event, deps, { revokeOnly: false });
  assert.deepEqual([...state.refunds.entries()], [[refundKey, 're_first']], 'the first refund, recovered on the shared key');
  assert.equal(state.cancels, 0, 'already canceled in Stripe');
  assert.equal((await store.checkoutStopAudits(sessionId)).finished, true);
  assert.equal(actions.includes('checkout.completed'), false);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'canceled', 'canceled without a deletion event');
  assert.equal((await store.overview((await store.findCheckoutIntent(sessionId))!.userId)).subscription.plan, 'free');
});

// Security R8-2: a started stop on a session that needed no payment, whose cancel went through at Stripe
// but whose write after it failed. On the retry Stripe shows it canceled and the session isn't paid, so
// neither branch runs; the stored active row must still lose access now.
test('a started stop on an unpaid session that Stripe already canceled cancels the stored active row on the retry', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  (event.data.object as Stripe.Checkout.Session).payment_status = 'no_payment_required';
  const { store, workspaceId, sessionId } = await storeWithIntent(event);
  const { state, deps } = stripeFor(workspaceId, subscriptionId);
  await store.recordAudit(null, workspaceId, 'checkout.stop_started', { checkoutSessionId: sessionId, subscriptionId });
  await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', subscriptionId), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'active', 'stored as active before the retry');
  state.status = 'canceled';

  await processStripeEvent(store, event, deps, { revokeOnly: true });
  assert.equal(state.refundCalls, 0, 'nothing was paid, nothing is refunded');
  assert.equal(state.cancels, 0, 'already canceled in Stripe');
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'canceled', 'access ends without waiting for the deletion event');
  assert.equal((await store.overview((await store.findCheckoutIntent(sessionId))!.userId)).subscription.plan, 'free');
});

// Security R8-1: free months granted onto the canceled row (gift, welcome, referral, promo) must survive a
// stop for the old subscription that is still retrying, say on "no payment found to refund yet".
test('free Pro months granted after a locked stop canceled the row survive a retry of that stop', async () => {
  const subscriptionId = `sub_${randomUUID()}`;
  const event = lockedPaidSession('', subscriptionId);
  const { store, workspaceId, sessionId } = await storeWithIntent(event);
  const { state, deps } = stripeFor(workspaceId, subscriptionId);
  const userId = (await store.findCheckoutIntent(sessionId))!.userId;
  await store.recordAudit(null, workspaceId, 'checkout.stop_started', { checkoutSessionId: sessionId, subscriptionId });
  await processStripeEvent(store, subscriptionEvent('customer.subscription.updated', subscriptionId), deps);
  state.status = 'canceled';
  await processStripeEvent(store, subscriptionEvent('customer.subscription.deleted', subscriptionId), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'canceled');

  assert.equal((await store.addProMonths(userId, 1)).applied, true, 'a gift month lands on the canceled row');
  const granted = await store.subscriptionByWorkspaceId(workspaceId);
  assert.equal(granted?.status, 'trialing');
  assert.equal(granted?.stripeSubscriptionId, undefined, 'the old Stripe subscription id is dropped with the grant');
  assert.equal(granted?.stripeCustomerId, 'cus_stop', 'the Stripe customer is kept for a later checkout');

  // The stop retries (paid, Stripe canceled, refund recovered on the shared key) and must not touch the gift.
  await processStripeEvent(store, event, deps, { revokeOnly: true });
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'trialing', 'the free month survives the retry');
  assert.equal((await store.overview(userId)).subscription.plan, 'pro');
  // A late deletion for the old subscription can't find the row either.
  await processStripeEvent(store, subscriptionEvent('customer.subscription.deleted', subscriptionId), deps);
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'trialing');
});

function lockedLifetimeSession(paymentIntent: string): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'checkout.session.completed',
    data: { object: { id: `cs_test_${randomUUID()}`, mode: 'payment', payment_status: 'paid', payment_intent: paymentIntent, customer: 'cus_lifetime' } },
  } as unknown as Stripe.Event;
}

test('a locked Lifetime already stored with access returns without a start row or a Stripe call', async () => {
  const paymentIntent = `pi_${randomUUID()}`;
  const event = lockedLifetimeSession(paymentIntent);
  const { store, workspaceId, sessionId } = await storeWithIntent(event);
  await store.syncSubscription({
    workspaceId, plan: 'pro', interval: 'lifetime', status: 'active', seats: 1, stripeCustomerId: 'cus_lifetime',
    stripeSubscriptionId: paymentIntent, stripePriceId: 'price_pro_lifetime', cancelAtPeriodEnd: false,
  });
  const stripeCalls: string[] = [];
  const deps = {
    retrieveSubscription: async () => { stripeCalls.push('retrieve'); throw new Error('not used'); },
    refundPayment: async () => { stripeCalls.push('refund'); return 're_unexpected'; },
  };
  await processStripeEvent(store, event, deps, { revokeOnly: true });
  assert.deepEqual(stripeCalls, []);
  assert.deepEqual(await store.checkoutStopAudits(sessionId), { started: false, finished: false }, 'no stop_started row');
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.status, 'active', 'the Lifetime grant is left alone');
});

test('a locked redelivery of a finished Lifetime stop refunds nothing more and writes no second completion row', async () => {
  const paymentIntent = `pi_${randomUUID()}`;
  const event = lockedLifetimeSession(paymentIntent);
  const { store, actions, workspaceId } = await storeWithIntent(event);
  let refundCalls = 0;
  const deps = {
    retrieveSubscription: async () => { throw new Error('not used'); },
    refundPayment: async () => { refundCalls += 1; return 're_lifetime'; },
  };
  const original = console.error;
  console.error = () => undefined;
  try {
    await processStripeEvent(store, event, deps, { revokeOnly: true });
    assert.equal(refundCalls, 1);
    await processStripeEvent(store, { ...event, id: `evt_${randomUUID()}` }, deps, { revokeOnly: true });
  } finally {
    console.error = original;
  }
  assert.equal(refundCalls, 1, 'no second refund call');
  assert.deepEqual(actions, ['checkout.stop_started', 'checkout.stopped_while_locked'], 'one start row and one completion row');
  assert.equal((await store.subscriptionByWorkspaceId(workspaceId))?.stripeSubscriptionId, undefined, 'nothing granted');
});
