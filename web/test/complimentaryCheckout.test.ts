import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import type Stripe from 'stripe';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { POST as redeemRoute } from '../app/api/v1/promo/redeem/route';
import { seedMemoryPromoBatch } from '../src/billing/promo';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';
import { getStore } from '../src/data/store';
import { PROMO_ALPHABET, promoCodeHash } from '../src/lib/promoCode';

// Real checkout, promo and webhook routes on the memory stores. Test-mode key; every Stripe method
// these flows reach is replaced on the cached client and counted, so no request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
delete process.env.APP_URL;
delete process.env.PUBLIC_APP_URL;
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnlyNeverSent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual';

const DAY_MS = 24 * 60 * 60 * 1000;

const stripe = getStripe();
const calls: string[] = [];
const canceled = new Set<string>();
const refundKeys: string[] = [];
const cancelKeys: string[] = [];

stripe.checkout.sessions.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
  calls.push(`checkout.sessions.create:${params.line_items?.[0]?.price}`);
  const id = `cs_test_${randomUUID()}`;
  return { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', expires_at: params.expires_at };
}) as unknown as typeof stripe.checkout.sessions.create;
stripe.checkout.sessions.retrieve = (async (id: string) => {
  calls.push(`checkout.sessions.retrieve:${id}`);
  return { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open' };
}) as unknown as typeof stripe.checkout.sessions.retrieve;

function useSubscription(workspaceId: string): void {
  stripe.subscriptions.retrieve = (async (id: string) => {
    calls.push(`subscriptions.retrieve:${id}`);
    return {
      id, status: canceled.has(id) ? 'canceled' : 'active', customer: 'cus_crossover', cancel_at_period_end: false, cancel_at: null, created: 1_797_000_000,
      metadata: { workspace_id: workspaceId, plan: 'pro', interval: 'monthly' },
      items: { data: [{ quantity: 1, price: { id: 'price_pro_monthly' }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
    };
  }) as unknown as typeof stripe.subscriptions.retrieve;
}
stripe.invoices.list = (async (params: Stripe.InvoiceListParams) => {
  calls.push(`invoices.list:${params.subscription}`);
  return { data: [{ id: `in_${params.subscription}`, status: 'paid' }] };
}) as unknown as typeof stripe.invoices.list;
stripe.invoicePayments.list = (async (params: Stripe.InvoicePaymentListParams) => {
  calls.push(`invoicePayments.list:${params.invoice}`);
  return { data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: `pi_${params.invoice}` } }] };
}) as unknown as typeof stripe.invoicePayments.list;
stripe.refunds.create = (async (_params: Stripe.RefundCreateParams, options: Stripe.RequestOptions) => {
  refundKeys.push(String(options.idempotencyKey));
  return { id: 're_crossover' };
}) as unknown as typeof stripe.refunds.create;
stripe.subscriptions.cancel = (async (id: string, _params: unknown, options: Stripe.RequestOptions) => {
  cancelKeys.push(String(options.idempotencyKey));
  canceled.add(id);
  return { id, status: 'canceled' };
}) as unknown as typeof stripe.subscriptions.cancel;

/** One fresh promo code worth `months`, seeded the way the hash-only SQL insert seeds production. */
function promoCode(months: number): string {
  const code = Array.from({ length: 16 }, () => PROMO_ALPHABET[randomInt(32)]).join('');
  seedMemoryPromoBatch({
    id: `batch-${randomUUID()}`, months, maxRedemptions: 10,
    redeemBy: new Date(Date.now() + 30 * DAY_MS).toISOString(), revokedAt: null,
  }, [promoCodeHash(code)]);
  return code;
}

let ipCounter = 0;
async function redeem(token: string, code: string): Promise<string> {
  ipCounter += 1;
  const response = await redeemRoute(new Request('https://api.example.test/api/v1/promo/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.77.0.${ipCounter}` },
    body: JSON.stringify({ accessToken: token, code }),
  }));
  const body = await response.json() as { ok: boolean; proUntil?: string };
  assert.equal(response.status, 200);
  assert.ok(body.ok && body.proUntil, 'the promo code was redeemed');
  return body.proUntil;
}

async function startCheckout(token: string, interval: 'monthly' | 'annual'): Promise<{ status: number; body: { error?: string; message?: string; proUntil?: string; url?: string } }> {
  const response = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'pro', interval }),
  }));
  return { status: response.status, body: await response.json() as { error?: string; message?: string; proUntil?: string; url?: string } };
}

function deliver(event: { type: string; data: { object: Record<string, unknown> } }): Promise<Response> {
  const payload = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', livemode: false, ...event });
  return webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' }) },
    body: payload,
  }));
}

async function person(): Promise<{ userId: string; token: string; email: string }> {
  const email = `comp-${randomUUID()}@checkout.test`;
  const account = await getStore().signIn(email);
  return { userId: account.userId, token: account.token, email };
}

async function storedRow(userId: string) {
  const workspace = await getBillingStore().ensurePersonalWorkspace(userId);
  return { workspace, row: await getBillingStore().subscriptionByWorkspaceId(workspace.id) };
}

test('complimentary Pro refuses monthly and annual checkout with 409 and its end date, before any Stripe call', async () => {
  const me = await person();
  const proUntil = await redeem(me.token, promoCode(3));
  calls.length = 0;
  for (const interval of ['monthly', 'annual'] as const) {
    const res = await startCheckout(me.token, interval);
    assert.equal(res.status, 409, interval);
    assert.equal(res.body.error, 'complimentary_active', interval);
    assert.equal(res.body.proUntil, proUntil, interval);
    const until = new Date(proUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    assert.equal(res.body.message, `You already have Pro until ${until}. You can subscribe after that.`, interval);
  }
  assert.deepEqual(calls, [], 'no Stripe call');
  const { workspace, row } = await storedRow(me.userId);
  assert.equal(await getBillingStore().pendingCheckout(me.userId, workspace.id), null, 'no checkout intent');
  assert.equal(row?.currentPeriodEnd, proUntil, 'the complimentary end date is unchanged');
  assert.equal(row?.stripeSubscriptionId, undefined);
});

test('an open checkout session is not reused while complimentary Pro runs', async () => {
  const me = await person();
  calls.length = 0;
  assert.equal((await startCheckout(me.token, 'monthly')).status, 201, 'checkout opens on Free');
  await redeem(me.token, promoCode(1));
  calls.length = 0;
  const again = await startCheckout(me.token, 'monthly');
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'complimentary_active');
  assert.deepEqual(calls, [], 'the open session was not retrieved or handed out');
});

test('once complimentary Pro has ended, checkout is allowed again', async () => {
  const me = await person();
  const proUntil = await redeem(me.token, promoCode(1));
  mock.timers.enable({ apis: ['Date'], now: new Date(proUntil).getTime() + 60_000 });
  try {
    // The clock moved past the session lifetime too, so sign in again on the same account.
    const later = await getStore().signIn(me.email);
    assert.equal(later.userId, me.userId);
    calls.length = 0;
    const res = await startCheckout(later.token, 'annual');
    assert.equal(res.status, 201);
    assert.ok(res.body.url?.startsWith('https://checkout.stripe.com/'));
    assert.deepEqual(calls, ['checkout.sessions.create:price_pro_annual']);
  } finally {
    mock.timers.reset();
  }
});

test('a session opened before a promo is redeemed keeps the promo end when it completes; the paid subscription is refunded and canceled once', async () => {
  const me = await person();
  const opened = await startCheckout(me.token, 'monthly');
  assert.equal(opened.status, 201);
  const { workspace } = await storedRow(me.userId);
  const intent = await getBillingStore().pendingCheckout(me.userId, workspace.id);
  assert.ok(intent?.stripeCheckoutSessionId);
  const proUntil = await redeem(me.token, promoCode(3));

  const subscriptionId = `sub_${randomUUID()}`;
  useSubscription(workspace.id);
  refundKeys.length = 0;
  cancelKeys.length = 0;
  const session = {
    id: intent.stripeCheckoutSessionId, object: 'checkout.session', mode: 'subscription', subscription: subscriptionId,
    metadata: { workspace_id: workspace.id, user_id: me.userId, plan: 'pro', interval: 'monthly', checkout_intent_id: intent.id },
  };
  const original = console.error;
  console.error = () => undefined;
  try {
    const completed = await deliver({ type: 'checkout.session.completed', data: { object: session } });
    assert.equal(completed.status, 200);
    // Stripe's other events for the same subscription, and a second delivery of the completion.
    for (const event of [
      { type: 'customer.subscription.created', data: { object: { id: subscriptionId, object: 'subscription' } } },
      { type: 'invoice.paid', data: { object: { id: `in_${randomUUID()}`, object: 'invoice', parent: { subscription_details: { subscription: subscriptionId } } } } },
      { type: 'customer.subscription.updated', data: { object: { id: subscriptionId, object: 'subscription' } } },
      { type: 'checkout.session.completed', data: { object: session } },
    ]) {
      assert.equal((await deliver(event)).status, 200, event.type);
    }
  } finally {
    console.error = original;
  }

  const { row } = await storedRow(me.userId);
  assert.equal(row?.currentPeriodEnd, proUntil, 'the promo end is kept');
  assert.equal(row?.status, 'trialing');
  assert.equal(row?.stripeSubscriptionId, undefined, 'the paid subscription was not stored over the promo');
  assert.deepEqual(refundKeys, [`uncode-dup-refund-${subscriptionId}-pi_in_${subscriptionId}`], 'refunded exactly once');
  assert.deepEqual(cancelKeys, [`uncode-dup-cancel-${subscriptionId}`], 'canceled exactly once');
  assert.equal(await getBillingStore().pendingCheckout(me.userId, workspace.id), null, 'the checkout intent is closed');
});
