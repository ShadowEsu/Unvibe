import assert from 'node:assert/strict';
import test from 'node:test';
import { getStore } from '../src/data/store';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { GET as overview } from '../app/api/v1/billing/overview/route';
import { PATCH as seats } from '../app/api/v1/billing/seats/route';
import { livePaymentsLocked } from '../src/billing/stripe';

// Live money stays off until Preston approves it. These tests use fake key strings only;
// a locked request must be refused before any Stripe call is attempted.
const STRIPE_ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_ANNUAL', 'STRIPE_PRICE_PRO_LIFETIME', 'BILLING_LIVE_PAYMENTS_APPROVED', 'BILLING_LIFETIME_ENABLED'] as const;

function withBillingEnv(values: Partial<Record<(typeof STRIPE_ENV)[number], string>>, run: () => Promise<void> | void) {
  return async () => {
    const saved = Object.fromEntries(STRIPE_ENV.map((k) => [k, process.env[k]]));
    for (const k of STRIPE_ENV) delete process.env[k];
    Object.assign(process.env, { STRIPE_WEBHOOK_SECRET: 'whsec_fake', STRIPE_PRICE_PRO_MONTHLY: 'price_pm', STRIPE_PRICE_PRO_ANNUAL: 'price_pa' }, values);
    try { await run(); } finally {
      for (const k of STRIPE_ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
  };
}

async function signedIn() {
  const account = await getStore().signIn(`live-lock-${crypto.randomUUID()}@example.test`);
  return account.token;
}

const post = (token: string, body: unknown) => new Request('https://example.test/api/v1/billing/checkout', {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('a live or restricted-live Stripe key alone keeps payments locked', withBillingEnv({}, () => {
  for (const key of ['sk_live_fake', 'rk_live_fake']) {
    process.env.STRIPE_SECRET_KEY = key;
    delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
    assert.equal(livePaymentsLocked(), true, key);
    process.env.BILLING_LIVE_PAYMENTS_APPROVED = 'yes';
    assert.equal(livePaymentsLocked(), true, `${key} with a non-exact approval value`);
    process.env.BILLING_LIVE_PAYMENTS_APPROVED = 'true';
    assert.equal(livePaymentsLocked(), false, `${key} after explicit approval`);
  }
  for (const key of ['sk_test_fake', 'rk_test_fake']) {
    process.env.STRIPE_SECRET_KEY = key;
    delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
    assert.equal(livePaymentsLocked(), false, key);
  }
}));

test('checkout refuses every plan with payments_not_open while live payments are locked', withBillingEnv({ STRIPE_SECRET_KEY: 'sk_live_fake', STRIPE_PRICE_PRO_LIFETIME: 'price_life', BILLING_LIFETIME_ENABLED: 'true' }, async () => {
  const token = await signedIn();
  for (const body of [{ plan: 'pro', interval: 'monthly' }, { plan: 'pro', interval: 'annual' }, { plan: 'pro', interval: 'lifetime' }, { plan: 'teams', interval: 'monthly', seats: 3 }]) {
    const res = await checkout(post(token, body));
    assert.equal(res.status, 503, JSON.stringify(body));
    const json = await res.json() as { error: string; message: string };
    assert.equal(json.error, 'payments_not_open', JSON.stringify(body));
    assert.match(json.message, /open soon/i);
  }
}));

test('seat changes are refused while live payments are locked', withBillingEnv({ STRIPE_SECRET_KEY: 'sk_live_fake' }, async () => {
  const token = await signedIn();
  const res = await seats(new Request('https://example.test/api/v1/billing/seats', {
    method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId: 'w', seats: 4 }),
  }));
  assert.equal(res.status, 503);
  assert.equal((await res.json() as { error: string }).error, 'payments_not_open');
}));

test('the plan overview reports checkout closed and payments not open under a live key', withBillingEnv({ STRIPE_SECRET_KEY: 'sk_live_fake', STRIPE_PRICE_PRO_LIFETIME: 'price_life' }, async () => {
  const token = await signedIn();
  const res = await overview(new Request('https://example.test/api/v1/billing/overview', { headers: { authorization: `Bearer ${token}` } }));
  assert.equal(res.status, 200);
  const json = await res.json() as { checkoutAvailable: boolean; lifetimeAvailable: boolean; teamsAvailable: boolean; paymentsOpen: boolean };
  assert.deepEqual({ checkout: json.checkoutAvailable, lifetime: json.lifetimeAvailable, teams: json.teamsAvailable, open: json.paymentsOpen }, { checkout: false, lifetime: false, teams: false, open: false });
}));

test('Lifetime stays hidden and refused in test mode unless explicitly enabled', withBillingEnv({ STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_PRICE_PRO_LIFETIME: 'price_life' }, async () => {
  const token = await signedIn();
  const view = await (await overview(new Request('https://example.test/api/v1/billing/overview', { headers: { authorization: `Bearer ${token}` } }))).json() as { checkoutAvailable: boolean; lifetimeAvailable: boolean; paymentsOpen: boolean };
  assert.deepEqual({ checkout: view.checkoutAvailable, lifetime: view.lifetimeAvailable, open: view.paymentsOpen }, { checkout: true, lifetime: false, open: true });
  const res = await checkout(post(token, { plan: 'pro', interval: 'lifetime' }));
  assert.equal(res.status, 503);
  assert.equal((await res.json() as { error: string }).error, 'lifetime_unavailable');
}));
