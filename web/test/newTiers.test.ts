import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type Stripe from 'stripe';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { getStore } from '../src/data/store';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { getBillingStore } from '../src/billing/store';
import { getStripe, newTierCheckoutOpen } from '../src/billing/stripe';
import { LIFETIME_PERIOD_END, newTiersEnabled, planDisplayName, planLimit } from '../src/billing/plans';
import type { PlanId, UsageKind } from '../src/billing/types';
import { processStripeEvent, type StripeWebhookDependencies } from '../src/billing/webhooks';
import { paymentIntent } from './stripeFakes';

// Enterprise and Big Business behind BILLING_NEW_TIERS_ENABLED. Real checkout route and webhook
// handler on the memory stores; the cached Stripe client's Checkout methods are replaced, so no
// request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
delete process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION;
delete process.env.BILLING_NEW_TIERS_ENABLED;
delete process.env.APP_URL;
delete process.env.PUBLIC_APP_URL;
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnlyNeverSent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual';
process.env.STRIPE_PRICE_PRO_LIFETIME = 'price_pro_lifetime';
process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = 'price_enterprise_monthly';
process.env.STRIPE_PRICE_BUSINESS_LIFETIME = 'price_business_lifetime';

/** Every value other than exactly `true` keeps the new tiers off. */
const OFF_VALUES = [undefined, '', 'TRUE', 'True', '1', 'yes', 'true ', ' true', 'true\n'] as const;

async function withFlag(value: string | undefined, run: () => Promise<void>): Promise<void> {
  const saved = process.env.BILLING_NEW_TIERS_ENABLED;
  if (value === undefined) delete process.env.BILLING_NEW_TIERS_ENABLED; else process.env.BILLING_NEW_TIERS_ENABLED = value;
  try { await run(); } finally {
    if (saved === undefined) delete process.env.BILLING_NEW_TIERS_ENABLED; else process.env.BILLING_NEW_TIERS_ENABLED = saved;
  }
}

const sessions: Stripe.Checkout.SessionCreateParams[] = [];
const sessionsApi = getStripe().checkout.sessions;
sessionsApi.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
  sessions.push(params);
  const id = `cs_test_${randomUUID()}`;
  return { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', expires_at: params.expires_at };
}) as unknown as typeof sessionsApi.create;
sessionsApi.retrieve = (async () => { throw new Error('retrieve is not expected in these tests'); }) as unknown as typeof sessionsApi.retrieve;

async function buyer(): Promise<{ userId: string; token: string }> {
  const account = await getStore().signIn(`tiers-${randomUUID()}@checkout.test`);
  return { userId: account.userId, token: account.token };
}

async function start(token: string, plan: string, interval: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan, interval }),
  }));
  const json: unknown = await response.json();
  assert.ok(json !== null && typeof json === 'object' && !Array.isArray(json));
  return { status: response.status, body: Object.fromEntries(Object.entries(json)) };
}

async function openIntent(userId: string): Promise<boolean> {
  const personal = (await getBillingStore().listWorkspaces(userId)).find((w) => w.type === 'personal');
  return personal ? (await getBillingStore().pendingCheckout(userId, personal.id)) !== null : false;
}

test('the flag is on only for exactly "true"', async () => {
  assert.equal(newTiersEnabled({ BILLING_NEW_TIERS_ENABLED: 'true' }), true);
  for (const value of OFF_VALUES) assert.equal(newTiersEnabled({ BILLING_NEW_TIERS_ENABLED: value }), false, JSON.stringify(value));
  assert.equal(newTiersEnabled({}), false);
  // The checkout gate for each new plan reads the same flag, whatever else is configured.
  for (const value of OFF_VALUES) {
    await withFlag(value, async () => {
      assert.equal(newTierCheckoutOpen('enterprise'), false);
      assert.equal(newTierCheckoutOpen('business'), false);
    });
  }
  await withFlag('true', async () => {
    assert.equal(newTierCheckoutOpen('enterprise'), true);
    assert.equal(newTierCheckoutOpen('business'), true);
  });
});

test('flag off (any value but exactly "true"): checkout answers 400 plan_unavailable for both new plans, with no Stripe call and no intent', async () => {
  for (const value of OFF_VALUES) {
    await withFlag(value, async () => {
      for (const [plan, interval] of [['enterprise', 'monthly'], ['business', 'lifetime']] as const) {
        const me = await buyer();
        sessions.length = 0;
        const result = await start(me.token, plan, interval);
        assert.equal(result.status, 400, `${plan} with flag ${JSON.stringify(value)}`);
        assert.equal(result.body.error, 'plan_unavailable');
        assert.equal(sessions.length, 0);
        assert.equal(await openIntent(me.userId), false);
      }
    });
  }
  // Pro is untouched by the flag.
  await withFlag(undefined, async () => {
    const me = await buyer();
    assert.equal((await start(me.token, 'pro', 'monthly')).status, 201);
  });
});

test('flag on: Enterprise is a monthly one-seat subscription at its own price, metadata nominates the plan', async () => {
  await withFlag('true', async () => {
    const me = await buyer();
    sessions.length = 0;
    const result = await start(me.token, 'enterprise', 'monthly');
    assert.equal(result.status, 201);
    const [params] = sessions;
    assert.equal(params?.mode, 'subscription');
    assert.deepEqual(params?.line_items, [{ price: 'price_enterprise_monthly', quantity: 1 }]);
    assert.equal(params?.metadata?.plan, 'enterprise');
    assert.equal(params?.subscription_data?.metadata?.plan, 'enterprise');
    const annual = await start((await buyer()).token, 'enterprise', 'annual');
    assert.equal(annual.status, 400);
    assert.equal(annual.body.error, 'invalid_checkout');
  });
});

test('flag on: Big Business takes the one-time payment path with only its own price; nothing in the session sells a call', async () => {
  await withFlag('true', async () => {
    const me = await buyer();
    sessions.length = 0;
    const result = await start(me.token, 'business', 'lifetime');
    assert.equal(result.status, 201);
    const [params] = sessions;
    assert.equal(params?.mode, 'payment');
    assert.deepEqual(params?.line_items, [{ price: 'price_business_lifetime', quantity: 1 }]);
    assert.equal(params?.metadata?.plan, 'business');
    assert.equal(params?.payment_intent_data?.metadata?.plan, 'business');
    assert.equal(params?.custom_text, undefined, 'no extra checkout or receipt text');
    assert.equal(params !== undefined && 'allow_promotion_codes' in params, false, 'no promotion code can discount Big Business');
    assert.doesNotMatch(JSON.stringify(params), /\bcall\b|meeting|founder/i);
    const monthly = await start((await buyer()).token, 'business', 'monthly');
    assert.equal(monthly.status, 400);
    assert.equal(monthly.body.error, 'invalid_checkout');
  });
});

test('promotion codes: Pro (monthly and lifetime) and Enterprise keep them, Big Business never has them', async () => {
  await withFlag('true', async () => {
    const saved = process.env.BILLING_LIFETIME_ENABLED;
    process.env.BILLING_LIFETIME_ENABLED = 'true';
    try {
      for (const [plan, interval, allowed] of [['pro', 'monthly', true], ['pro', 'lifetime', true], ['enterprise', 'monthly', true], ['business', 'lifetime', false]] as const) {
        sessions.length = 0;
        assert.equal((await start((await buyer()).token, plan, interval)).status, 201, `${plan} ${interval}`);
        assert.equal(sessions.length, 1);
        assert.equal(sessions[0]?.allow_promotion_codes, allowed ? true : undefined, `${plan} ${interval}`);
      }
    } finally {
      if (saved === undefined) delete process.env.BILLING_LIFETIME_ENABLED; else process.env.BILLING_LIFETIME_ENABLED = saved;
    }
  });
});

test('flag on: the payment locks still apply on top (test key on production, live key off production)', async () => {
  await withFlag('true', async () => {
    const testKey = process.env.STRIPE_SECRET_KEY;
    for (const [key, vercelEnv] of [[testKey, 'production'], ['sk_live_localOnlyNeverSent', undefined]] as const) {
      process.env.STRIPE_SECRET_KEY = key;
      if (vercelEnv) process.env.VERCEL_ENV = vercelEnv; else delete process.env.VERCEL_ENV;
      try {
        for (const [plan, interval] of [['enterprise', 'monthly'], ['business', 'lifetime']] as const) {
          sessions.length = 0;
          const result = await start((await buyer()).token, plan, interval);
          assert.equal(result.status, 503, `${plan} with ${key?.slice(0, 8)} on ${vercelEnv ?? 'local'}`);
          assert.equal(result.body.error, 'payments_not_open');
          assert.equal(sessions.length, 0);
        }
      } finally {
        process.env.STRIPE_SECRET_KEY = testKey;
        delete process.env.VERCEL_ENV;
      }
    }
  });
});

test('flag on but no price configured for a new plan: refused before any intent', async () => {
  await withFlag('true', async () => {
    const saved = process.env.STRIPE_PRICE_BUSINESS_LIFETIME;
    delete process.env.STRIPE_PRICE_BUSINESS_LIFETIME;
    try {
      const me = await buyer();
      const result = await start(me.token, 'business', 'lifetime');
      assert.equal(result.status, 503);
      assert.equal(result.body.error, 'plan_unavailable');
      assert.equal(await openIntent(me.userId), false);
    } finally { process.env.STRIPE_PRICE_BUSINESS_LIFETIME = saved; }
  });
});

// ---------------------------------------------------------------- webhook

type Audit = { action: string; metadata: Record<string, unknown> };

async function customer() {
  const store = new MemoryBillingStore();
  const audits: Audit[] = [];
  const record = store.recordAudit.bind(store);
  store.recordAudit = async (userId, workspaceId, action, metadata = {}) => {
    audits.push({ action, metadata });
    return record(userId, workspaceId, action, metadata);
  };
  const userId = randomUUID();
  const workspace = await store.ensurePersonalWorkspace(userId);
  return { store, audits, userId, workspaceId: workspace.id };
}

function businessPaid(workspaceId: string, userId: string, price: string, paymentIntent: string, customerId: string, plan = 'business'): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'checkout.session.completed', livemode: false,
    data: { object: {
      id: `cs_test_${randomUUID()}`, object: 'checkout.session', mode: 'payment', payment_status: 'paid',
      metadata: { workspace_id: workspaceId, user_id: userId, plan, interval: 'lifetime' },
      line_items: { data: [{ price: { id: price } }] },
      customer: customerId, payment_intent: paymentIntent,
    } },
  } as unknown as Stripe.Event;
}

function enterpriseSubscription(workspaceId: string, price = 'price_enterprise_monthly', quantity = 1): Stripe.Subscription {
  return {
    id: `sub_${randomUUID()}`, status: 'active', customer: `cus_${randomUUID()}`, cancel_at_period_end: false, created: 1_797_000_000,
    metadata: { workspace_id: workspaceId, plan: 'enterprise', interval: 'monthly' },
    items: { data: [{ quantity, price: { id: price }, current_period_start: 1_797_321_600, current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
}

/**
 * Stripe as the handlers see it. Without retrieveCheckoutSession the event's own session (with its
 * line items) is used. `intent` is Stripe's PaymentIntent read (good by default); `paid` are the
 * PaymentIntents of the subscription's latest paid invoice.
 */
function deps(subscription?: Stripe.Subscription, intent: (id: string) => Stripe.PaymentIntent = paymentIntent, paid: string[] = []): StripeWebhookDependencies {
  return {
    retrieveSubscription: async () => { if (!subscription) throw new Error('not used'); return subscription; },
    invoicesForPaymentIntent: async () => [],
    cancelSubscription: async () => { throw new Error('a one-time payment has no subscription to cancel'); },
    latestPaidInvoicePayments: async () => paid.map((pi) => ({ payment: { type: 'payment_intent', payment_intent: pi } }) as Stripe.InvoicePayment),
    retrievePaymentIntent: async (id) => intent(id),
  };
}

function enterpriseCheckoutCompleted(workspaceId: string, subscriptionId: string): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'checkout.session.completed', livemode: false,
    data: { object: { id: `cs_test_${randomUUID()}`, object: 'checkout.session', mode: 'subscription', subscription: subscriptionId, metadata: { workspace_id: workspaceId, plan: 'enterprise', interval: 'monthly' } } },
  } as unknown as Stripe.Event;
}

test('flag off: the webhook grants neither new plan, from checkout or from a subscription event', async () => {
  for (const value of OFF_VALUES) {
    await withFlag(value, async () => {
      const b = await customer();
      await processStripeEvent(b.store, businessPaid(b.workspaceId, b.userId, 'price_business_lifetime', `pi_${randomUUID()}`, `cus_${randomUUID()}`), deps());
      assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free', `business, flag ${JSON.stringify(value)}`);
      assert.ok(b.audits.some((a) => a.action === 'checkout.refused_plan_unavailable'));

      const e = await customer();
      const subscription = enterpriseSubscription(e.workspaceId);
      await processStripeEvent(e.store, enterpriseCheckoutCompleted(e.workspaceId, subscription.id), deps(subscription));
      await processStripeEvent(e.store, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', data: { object: { id: subscription.id } } } as unknown as Stripe.Event, deps(subscription));
      assert.equal((await e.store.overview(e.userId)).subscription.plan, 'free', `enterprise, flag ${JSON.stringify(value)}`);
      assert.ok(e.audits.some((a) => a.action === 'checkout.refused_plan_unavailable'));
      assert.ok(e.audits.some((a) => a.action === 'subscription.refused_plan_unavailable'));
    });
  }
});

test('flag on: a paid Big Business checkout grants Big Business for good (period end 2099-12-31) with its caps', async () => {
  await withFlag('true', async () => {
    const b = await customer();
    const paymentIntent = `pi_${randomUUID()}`;
    await processStripeEvent(b.store, businessPaid(b.workspaceId, b.userId, 'price_business_lifetime', paymentIntent, `cus_${randomUUID()}`), deps());
    const overview = await b.store.overview(b.userId);
    assert.equal(overview.subscription.plan, 'business');
    assert.equal(overview.subscription.interval, 'lifetime');
    assert.equal(overview.subscription.seats, 1);
    assert.equal(overview.subscription.stripeSubscriptionId, paymentIntent);
    assert.equal(overview.subscription.currentPeriodEnd, LIFETIME_PERIOD_END);
    assert.equal(LIFETIME_PERIOD_END, '2099-12-31T23:59:59.000Z');
    assert.equal(overview.usage.find((line) => line.kind === 'ai_explanation')?.limit, 5_000);
    assert.equal(overview.usage.find((line) => line.kind === 'project_question')?.limit, 10_000);
  });
});

test('flag on: a price-id or metadata mismatch grants nothing', async () => {
  await withFlag('true', async () => {
    // Metadata says business, the line item is the Pro Lifetime price.
    const b = await customer();
    await assert.rejects(processStripeEvent(b.store, businessPaid(b.workspaceId, b.userId, 'price_pro_lifetime', `pi_${randomUUID()}`, `cus_${randomUUID()}`), deps()), /does not match/);
    assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free');
    // Metadata says pro, the line item is the Big Business price: Pro Lifetime is not granted either.
    const p = await customer();
    await assert.rejects(processStripeEvent(p.store, businessPaid(p.workspaceId, p.userId, 'price_business_lifetime', `pi_${randomUUID()}`, `cus_${randomUUID()}`, 'pro'), deps()), /does not match/);
    assert.equal((await p.store.overview(p.userId)).subscription.plan, 'free');
    // Enterprise metadata on the Pro monthly price, or with two seats.
    for (const subscription of [enterpriseSubscription((await customer()).workspaceId, 'price_pro_monthly'), enterpriseSubscription((await customer()).workspaceId, 'price_enterprise_monthly', 2)]) {
      const e = await customer();
      const sub = { ...subscription, metadata: { ...subscription.metadata, workspace_id: e.workspaceId } } as Stripe.Subscription;
      await assert.rejects(processStripeEvent(e.store, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', data: { object: { id: sub.id } } } as unknown as Stripe.Event, deps(sub)));
      assert.equal((await e.store.overview(e.userId)).subscription.plan, 'free');
    }
    // Enterprise metadata with an annual interval: never sold, so never granted.
    const a = await customer();
    const annual = { ...enterpriseSubscription(a.workspaceId), metadata: { workspace_id: a.workspaceId, plan: 'enterprise', interval: 'annual' } } as unknown as Stripe.Subscription;
    await assert.rejects(processStripeEvent(a.store, { id: `evt_${randomUUID()}`, type: 'customer.subscription.updated', data: { object: { id: annual.id } } } as unknown as Stripe.Event, deps(annual)));
    assert.equal((await a.store.overview(a.userId)).subscription.plan, 'free');
  });
});

test('flag on: a matching Enterprise subscription grants Enterprise with 1,000 explanations', async () => {
  await withFlag('true', async () => {
    const e = await customer();
    const subscription = enterpriseSubscription(e.workspaceId);
    await processStripeEvent(e.store, enterpriseCheckoutCompleted(e.workspaceId, subscription.id), deps(subscription));
    const overview = await e.store.overview(e.userId);
    assert.equal(overview.subscription.plan, 'enterprise');
    assert.equal(overview.usage.find((line) => line.kind === 'ai_explanation')?.limit, 1_000);
  });
});

function refund(paymentIntent: string, customerId: string): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'charge.refunded', livemode: false,
    data: { object: { id: `ch_${randomUUID()}`, object: 'charge', amount: 500_000, amount_refunded: 500_000, refunded: true, currency: 'usd', payment_intent: paymentIntent, customer: customerId } },
  } as unknown as Stripe.Event;
}

function lostDispute(paymentIntent: string): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`, type: 'charge.dispute.closed', livemode: false,
    data: { object: { id: `dp_${randomUUID()}`, object: 'dispute', amount: 500_000, currency: 'usd', reason: 'fraudulent', status: 'lost', charge: `ch_${randomUUID()}`, payment_intent: paymentIntent, evidence_details: { due_by: 1_793_000_000 } } },
  } as unknown as Stripe.Event;
}

for (const [name, revoke] of [['a full refund', refund], ['a lost dispute', (pi: string) => lostDispute(pi)]] as const) {
  test(`${name} of the Big Business payment revokes Big Business, flag on or off`, async () => {
    for (const flagAfterGrant of ['true', undefined]) {
      const b = await customer();
      const paymentIntent = `pi_${randomUUID()}`;
      const customerId = `cus_${randomUUID()}`;
      await withFlag('true', () => processStripeEvent(b.store, businessPaid(b.workspaceId, b.userId, 'price_business_lifetime', paymentIntent, customerId), deps()));
      assert.equal((await b.store.overview(b.userId)).subscription.plan, 'business');
      await withFlag(flagAfterGrant, () => processStripeEvent(b.store, revoke(paymentIntent, customerId), deps()));
      assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free', `revoked with the flag ${String(flagAfterGrant)}`);
    }
  });
}

// ------------------------------------------------- refund-aware, ordered grants (security F1)

/** The event as Stripe stamps it: `created` in seconds. */
function at<T extends Stripe.Event>(event: T, created: number): T {
  return { ...event, created };
}

function retried(event: Stripe.Event, type: 'checkout.session.completed' | 'checkout.session.async_payment_succeeded'): Stripe.Event {
  return { ...event, id: `evt_${randomUUID()}`, type } as Stripe.Event;
}

const refundedIntent = (id: string) => paymentIntent(id, { refunded: true, amount_refunded: 500_000 });

function refusals(audits: Audit[], action: string): unknown[] {
  return audits.filter((a) => a.action === action).map((a) => a.metadata.reason);
}

test('P1: a full refund processed before checkout.session.completed leaves the account Free', async () => {
  await withFlag('true', async () => {
    // Stripe already reports the payment refunded, and so does the refund the webhook recorded.
    for (const intent of [refundedIntent, paymentIntent]) {
      const b = await customer();
      const pi = `pi_${randomUUID()}`;
      const cus = `cus_${randomUUID()}`;
      await processStripeEvent(b.store, refund(pi, cus), deps());
      await processStripeEvent(b.store, businessPaid(b.workspaceId, b.userId, 'price_business_lifetime', pi, cus), deps(undefined, intent));
      assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free');
      // The refund matched nothing when it arrived; its PaymentIntent is still on record and refuses the grant.
      assert.deepEqual(refusals(b.audits, 'checkout.refused_payment'), ['refund_recorded']);
    }
  });
});

test('P2: grant, a full refund revokes, then a retried completed or async_payment_succeeded does not grant again', async () => {
  await withFlag('true', async () => {
    const b = await customer();
    const pi = `pi_${randomUUID()}`;
    const cus = `cus_${randomUUID()}`;
    const paid = businessPaid(b.workspaceId, b.userId, 'price_business_lifetime', pi, cus);
    await processStripeEvent(b.store, paid, deps());
    assert.equal((await b.store.overview(b.userId)).subscription.plan, 'business');
    await processStripeEvent(b.store, refund(pi, cus), deps(undefined, refundedIntent));
    assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free');
    for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded'] as const) {
      await processStripeEvent(b.store, retried(paid, type), deps(undefined, refundedIntent));
      assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free', type);
    }
  });
});

test('a checkout event whose payment Stripe reports refunded, partly refunded, disputed or not succeeded grants nothing', async () => {
  await withFlag('true', async () => {
    const cases: Array<[string, (id: string) => Stripe.PaymentIntent]> = [
      ['refunded', refundedIntent],
      ['refunded', (id) => paymentIntent(id, { amount_refunded: 1_000 })],
      ['disputed', (id) => paymentIntent(id, { disputed: true })],
      ['not_succeeded', (id) => paymentIntent(id, {}, 'processing')],
    ];
    for (const [reason, intent] of cases) {
      const b = await customer();
      await processStripeEvent(b.store, businessPaid(b.workspaceId, b.userId, 'price_business_lifetime', `pi_${randomUUID()}`, `cus_${randomUUID()}`), deps(undefined, intent));
      assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free', reason);
      assert.deepEqual(refusals(b.audits, 'checkout.refused_payment'), [reason]);

      const e = await customer();
      const subscription = enterpriseSubscription(e.workspaceId);
      await processStripeEvent(e.store, enterpriseCheckoutCompleted(e.workspaceId, subscription.id), deps(subscription, intent, [`pi_${randomUUID()}`]));
      assert.equal((await e.store.overview(e.userId)).subscription.plan, 'free', `enterprise ${reason}`);
      assert.deepEqual(refusals(e.audits, 'subscription.refused_payment'), [reason]);
    }
  });
});

test('after a lost dispute revoked Big Business, a retried checkout event grants nothing even when Stripe still reads the payment as good', async () => {
  await withFlag('true', async () => {
    const b = await customer();
    const pi = `pi_${randomUUID()}`;
    const paid = businessPaid(b.workspaceId, b.userId, 'price_business_lifetime', pi, `cus_${randomUUID()}`);
    await processStripeEvent(b.store, paid, deps());
    await processStripeEvent(b.store, lostDispute(pi), deps());
    await processStripeEvent(b.store, retried(paid, 'checkout.session.completed'), deps());
    assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free');
    assert.deepEqual(refusals(b.audits, 'checkout.refused_payment'), ['revoked']);
  });
});

test('out of order: an event older than a newer refund leaves the account Free (Big Business and Enterprise)', async () => {
  await withFlag('true', async () => {
    // Big Business: paid at t1, refunded at t3, then the t1 checkout event is delivered again.
    const b = await customer();
    const pi = `pi_${randomUUID()}`;
    const cus = `cus_${randomUUID()}`;
    const paid = at(businessPaid(b.workspaceId, b.userId, 'price_business_lifetime', pi, cus), 1_797_000_100);
    await processStripeEvent(b.store, paid, deps());
    await processStripeEvent(b.store, at(refund(pi, cus), 1_797_000_300), deps());
    await processStripeEvent(b.store, retried(paid, 'checkout.session.async_payment_succeeded'), deps());
    assert.equal((await b.store.overview(b.userId)).subscription.plan, 'free');
    assert.deepEqual(refusals(b.audits, 'checkout.refused_payment'), ['stale_event']);

    // Enterprise: granted at t1, its current-period invoice refunded in full at t3 (canceled at
    // Stripe), then an invoice.paid from t2 arrives while Stripe's read still shows it active.
    const e = await customer();
    const subscription = enterpriseSubscription(e.workspaceId);
    const enterprisePi = `pi_${randomUUID()}`;
    const invoice = { id: `in_${randomUUID()}`, billing_reason: 'subscription_create', parent: { subscription_details: { subscription: subscription.id } }, lines: { data: [{ period: { start: 1_797_321_600 } }] } } as unknown as Stripe.Invoice;
    const canceled: string[] = [];
    const stripe: StripeWebhookDependencies = {
      ...deps(subscription),
      invoicesForPaymentIntent: async (id) => (id === enterprisePi ? [invoice] : []),
      cancelSubscription: async (id) => { canceled.push(id); },
    };
    await processStripeEvent(e.store, at(enterpriseCheckoutCompleted(e.workspaceId, subscription.id), 1_797_000_100), stripe);
    assert.equal((await e.store.overview(e.userId)).subscription.plan, 'enterprise');
    await processStripeEvent(e.store, at(refund(enterprisePi, String(subscription.customer)), 1_797_000_300), stripe);
    assert.deepEqual(canceled, [subscription.id]);
    assert.equal((await e.store.overview(e.userId)).subscription.plan, 'free');
    const late = { id: `evt_${randomUUID()}`, type: 'invoice.paid', created: 1_797_000_200, data: { object: invoice } } as unknown as Stripe.Event;
    await processStripeEvent(e.store, late, stripe);
    assert.equal((await e.store.overview(e.userId)).subscription.plan, 'free');
    assert.ok(e.audits.some((a) => a.action === 'subscription.ignored_stale_event'));
  });
});

// ------------------------------------------------- checkout guards (security F3, F4) and F11

test('GAP-M19: Enterprise and Big Business checkout always bind to the caller\'s personal workspace, never a team workspace', async () => {
  await withFlag('true', async () => {
    for (const [plan, interval] of [['enterprise', 'monthly'], ['business', 'lifetime']] as const) {
      const me = await buyer();
      const personal = await getBillingStore().ensurePersonalWorkspace(me.userId);
      const team = await getBillingStore().createTeamWorkspace(me.userId, 'Mine');
      sessions.length = 0;
      const response = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
        method: 'POST',
        headers: { authorization: `Bearer ${me.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ plan, interval, workspaceId: team.id }),
      }));
      assert.equal(response.status, 201, plan);
      assert.equal(sessions[0]?.metadata?.workspace_id, personal.id, `${plan} is bought for the personal workspace`);
    }
  });
});

test('GAP-M27: an account with Big Business cannot start another Big Business, Enterprise or Pro checkout', async () => {
  await withFlag('true', async () => {
    const me = await buyer();
    const workspace = await getBillingStore().ensurePersonalWorkspace(me.userId);
    await getBillingStore().syncSubscription({
      workspaceId: workspace.id, plan: 'business', interval: 'lifetime', status: 'active', seats: 1,
      stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `pi_${randomUUID()}`, stripePriceId: 'price_business_lifetime',
      currentPeriodStart: new Date().toISOString(), currentPeriodEnd: LIFETIME_PERIOD_END, cancelAtPeriodEnd: false,
    });
    for (const [plan, interval] of [['business', 'lifetime'], ['enterprise', 'monthly'], ['pro', 'monthly']] as const) {
      sessions.length = 0;
      const { status, body } = await start(me.token, plan, interval);
      assert.equal(status, 409, `${plan} ${interval}`);
      assert.equal(body.error, 'lifetime_active');
      assert.equal(sessions.length, 0);
    }
  });
});

test('F11: an unknown plan has no limits at all (never Pro\'s), so metering refuses instead of granting', () => {
  for (const kind of ['ai_explanation', 'project_question', 'indexed_project', 'dictionary_item', 'saved_item'] as const satisfies readonly UsageKind[]) {
    assert.throws(() => planLimit('gold' as PlanId, kind, 1), TypeError, kind);
  }
});

test('an unknown plan id shows "Paid plan", never Free', () => {
  assert.equal(planDisplayName('gold'), 'Paid plan');
  assert.equal(planDisplayName('constructor'), 'Paid plan');
  assert.equal(planDisplayName(''), 'Paid plan');
  assert.equal(planDisplayName('free'), 'Free');
  assert.equal(planDisplayName('enterprise'), 'Enterprise');
  assert.equal(planDisplayName('business'), 'Big Business');
});

test('the welcome month (on_app_account) is untouched: no migration after it redefines the trigger function', () => {
  const dir = join(process.cwd(), 'supabase/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const defining = files.filter((f) => /create\s+or\s+replace\s+function\s+(public\.)?on_app_account\s*\(/i.test(readFileSync(join(dir, f), 'utf8')));
  assert.equal(defining.at(-1), '20261022051500_gifts_require_signed_in_accounts.sql');
  const tiers = readFileSync(join(dir, '20261031090000_enterprise_business_tiers.sql'), 'utf8');
  assert.doesNotMatch(tiers, /on_app_account|welcome_pro_grants|add_pro_months|app_account_joined/);
});

test('the Supabase store writes stripe_event_at only with its own migration in the repo, after the tiers migration', () => {
  const storeSource = readFileSync(join(process.cwd(), 'src/billing/supabaseBillingStore.ts'), 'utf8');
  const dir = join(process.cwd(), 'supabase/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const adding = files.filter((f) => /alter\s+table\s+public\.subscriptions\s+add\s+column\s+if\s+not\s+exists\s+stripe_event_at\s+timestamptz\s*;/i.test(readFileSync(join(dir, f), 'utf8')));
  if (!storeSource.includes('stripe_event_at')) return;
  // Deploying the store without this column fails every subscription write, Pro included.
  assert.deepEqual(adding, ['20261031091000_subscriptions_stripe_event_at.sql']);
  assert.ok(files.indexOf(adding[0]) > files.indexOf('20261031090000_enterprise_business_tiers.sql'));
  const migration = readFileSync(join(dir, adding[0]), 'utf8');
  assert.match(migration, /^-- Rollback: alter table public\.subscriptions drop column if exists stripe_event_at;$/m);
  // The column is the only schema change in it.
  assert.deepEqual(migration.split('\n').filter((line) => line.trim() && !line.startsWith('--')), ['alter table public.subscriptions add column if not exists stripe_event_at timestamptz;']);
});
