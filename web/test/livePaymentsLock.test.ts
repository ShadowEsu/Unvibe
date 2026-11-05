import assert from 'node:assert/strict';
import test from 'node:test';
import { getStore } from '../src/data/store';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { GET as overview } from '../app/api/v1/billing/overview/route';
import { PATCH as seats } from '../app/api/v1/billing/seats/route';
import { POST as portal } from '../app/api/v1/billing/portal/route';
import { billingError } from '../src/billing/http';
import { automaticTax, billingMode, getStripe, paymentsLocked, webhookConfigured } from '../src/billing/stripe';
import { GET as health } from '../app/api/v1/health/route';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';

// Live money stays off until the owner approves it. These tests use fake key strings only;
// a locked request must be refused before any Stripe call is attempted.
const STRIPE_ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_ANNUAL', 'STRIPE_PRICE_PRO_LIFETIME', 'UNVIBE_CHECKOUT_LIVE', 'BILLING_LIFETIME_ENABLED', 'BILLING_TEST_CHECKOUT_IN_PRODUCTION', 'VERCEL_ENV', 'STRIPE_AUTOMATIC_TAX'] as const;

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

test('a restricted live key opens only on production with UNVIBE_CHECKOUT_LIVE exactly 1; a live secret key never opens', withBillingEnv({}, () => {
  for (const key of ['rk_live_fake']) {
    process.env.STRIPE_SECRET_KEY = key;
    process.env.VERCEL_ENV = 'production';
    delete process.env.UNVIBE_CHECKOUT_LIVE;
    assert.equal(paymentsLocked(), true, key);
    for (const value of ['yes', 'true', ' 1', '1\n', '01']) {
      process.env.UNVIBE_CHECKOUT_LIVE = value;
      assert.equal(paymentsLocked(), true, `${key} with approval ${JSON.stringify(value)}`);
    }
    process.env.UNVIBE_CHECKOUT_LIVE = '1';
    assert.equal(paymentsLocked(), false, `${key} on production after explicit approval`);
    for (const env of ['preview', 'development', undefined]) {
      if (env === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = env;
      assert.equal(paymentsLocked(), true, `${key} approved but off production (${env ?? 'local'})`);
    }
  }
  process.env.STRIPE_SECRET_KEY = 'sk_live_fake';
  process.env.VERCEL_ENV = 'production';
  process.env.UNVIBE_CHECKOUT_LIVE = '1';
  assert.equal(paymentsLocked(), true, 'a live secret key stays locked with every approval');
  assert.throws(() => getStripe(), /Stripe is not configured/, 'no client is built for a live secret key');
  delete process.env.VERCEL_ENV;
  for (const key of ['sk_test_fake', 'rk_test_fake']) {
    process.env.STRIPE_SECRET_KEY = key;
    delete process.env.UNVIBE_CHECKOUT_LIVE;
    assert.equal(paymentsLocked(), false, key);
  }
}));

// A test key on the production deployment would hand out real Pro for card 4242 and refuse
// every real card, so production stays closed on a test key; previews keep test checkout.
test('a test-mode key is locked on the production deployment only', withBillingEnv({ STRIPE_SECRET_KEY: 'sk_test_fake' }, async () => {
  process.env.VERCEL_ENV = 'preview';
  assert.equal(paymentsLocked(), false, 'preview keeps test checkout');
  process.env.VERCEL_ENV = 'production';
  assert.equal(paymentsLocked(), true, 'production with a test key');
  process.env.UNVIBE_CHECKOUT_LIVE = '1';
  assert.equal(paymentsLocked(), true, 'live approval does not open a test key in production');
  for (const value of [' true ', 'true\n', 'TRUE', 'yes']) {
    process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION = value;
    assert.equal(paymentsLocked(), true, `test-checkout flag ${JSON.stringify(value)} is not exact`);
  }
  process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION = 'true';
  assert.equal(paymentsLocked(), false, 'explicit test-checkout-in-production flag');
  delete process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION;
  const res = await checkout(post(await signedIn(), { plan: 'pro', interval: 'monthly' }));
  assert.equal(res.status, 503);
  assert.equal((await res.json() as { error: string }).error, 'payments_not_open');
}));

test('checkout refuses every plan with payments_not_open while live payments are locked', withBillingEnv({ STRIPE_SECRET_KEY: 'rk_live_fake', STRIPE_PRICE_PRO_LIFETIME: 'price_life', BILLING_LIFETIME_ENABLED: 'true' }, async () => {
  const token = await signedIn();
  for (const body of [{ plan: 'pro', interval: 'monthly' }, { plan: 'pro', interval: 'annual' }, { plan: 'pro', interval: 'lifetime' }, { plan: 'teams', interval: 'monthly', seats: 3 }]) {
    const res = await checkout(post(token, body));
    assert.equal(res.status, 503, JSON.stringify(body));
    const json = await res.json() as { error: string; message: string };
    assert.equal(json.error, 'payments_not_open', JSON.stringify(body));
    assert.match(json.message, /open soon/i);
  }
}));

test('seat changes are refused while live payments are locked', withBillingEnv({ STRIPE_SECRET_KEY: 'rk_live_fake' }, async () => {
  const token = await signedIn();
  const res = await seats(new Request('https://example.test/api/v1/billing/seats', {
    method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId: 'w', seats: 4 }),
  }));
  assert.equal(res.status, 503);
  assert.equal((await res.json() as { error: string }).error, 'payments_not_open');
}));

test('the billing portal is refused while payments are locked', withBillingEnv({ STRIPE_SECRET_KEY: 'rk_live_fake' }, async () => {
  const token = await signedIn();
  const res = await portal(new Request('https://example.test/api/v1/billing/portal', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}',
  }));
  assert.equal(res.status, 503);
  assert.equal((await res.json() as { error: string }).error, 'payments_not_open');
}));

test('billing errors never echo provider or configuration details to the client', async () => {
  const leaks = [
    new Error('STRIPE_PRICE_PRO_LIFETIME is not configured.'),
    new Error('No such customer: cus_123; a similar object exists in test mode, but a live mode key was used to make this request.'),
    new Error('Stripe is not configured. Set STRIPE_SECRET_KEY on the server.'),
  ];
  for (const [error, status] of leaks.flatMap((e) => [[e, 400], [e, 503]] as const)) {
    const body = await billingError(error, status).json() as { message: string };
    assert.doesNotMatch(body.message, /stripe|STRIPE_|cus_|live mode|test mode|configured/i, `${status}: ${error.message}`);
  }
  // Any 5xx is generic, whatever the message.
  assert.doesNotMatch((await billingError(new Error('relation usage_monthly does not exist'), 503).json() as { message: string }).message, /relation/);
  // Plain 4xx store messages that tell the user what to do still come through.
  const seat = await billingError(new Error('Add a paid seat before sending another invitation.'), 409).json() as { message: string };
  assert.equal(seat.message, 'Add a paid seat before sending another invitation.');
});

test('the plan overview reports checkout closed and payments not open under a live key', withBillingEnv({ STRIPE_SECRET_KEY: 'rk_live_fake', STRIPE_PRICE_PRO_LIFETIME: 'price_life' }, async () => {
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

// Security L4: the public health probe says whether checkout is off, test or live and whether the
// webhook can verify events, and nothing else about the configuration.
test('health reports billing off/test/live and webhookConfigured, and no configuration values', withBillingEnv({ STRIPE_SECRET_KEY: 'rk_live_fake', VERCEL_ENV: 'production' }, async () => {
  const read = async () => (await health()).json() as Promise<Record<string, unknown>>;
  assert.deepEqual(await read(), { ok: true, service: 'unvibe-api', version: 'v1', billing: 'off', webhookConfigured: true }, 'live key before approval');
  process.env.UNVIBE_CHECKOUT_LIVE = '1';
  const live = await read();
  assert.deepEqual(live, { ok: true, service: 'unvibe-api', version: 'v1', billing: 'live', webhookConfigured: true });
  for (const value of ['rk_live_fake', 'whsec_fake', 'price_pm']) assert.equal(JSON.stringify(live).includes(value), false, value);
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.VERCEL_ENV = 'preview';
  assert.equal(billingMode(), 'test');
  for (const placeholder of ['whsec_REPLACE_ME', 'whsec_replace-me', 'whsec_']) {
    process.env.STRIPE_WEBHOOK_SECRET = placeholder;
    assert.deepEqual([billingMode(), webhookConfigured()], ['off', false], `placeholder ${placeholder} closes checkout and the webhook`);
  }
}));

// A placeholder or newline-stored signing secret answers 503 before any verification, so the unsigned-POST
// gate after a deploy sees it; only a real whsec_ value is used.
test('the webhook answers 503 for a missing, placeholder or whitespace signing secret', withBillingEnv({ STRIPE_SECRET_KEY: 'sk_test_fake' }, async () => {
  for (const secret of [undefined, '', 'whsec_', 'whsec_replace-me', 'whsec_abc\n', ' whsec_abc', 'whsec_abc ', 'sk_test_fake', 'placeholder']) {
    if (secret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = secret;
    const res = await webhook(new Request('https://example.test/api/v1/billing/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body: '{}' }));
    assert.deepEqual([res.status, await res.json()], [503, { error: 'webhook_not_configured' }], JSON.stringify(secret));
  }
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_abc123';
  const res = await webhook(new Request('https://example.test/api/v1/billing/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body: '{}' }));
  assert.equal(res.status, 400, 'a real-shaped secret reaches signature verification, which refuses the forged header');
}));

// Ledger 415: Stripe Tax stays off until the owner turns it on in Stripe and sets STRIPE_AUTOMATIC_TAX=1.
test('Stripe Tax is off unless STRIPE_AUTOMATIC_TAX is exactly 1, and saves a returning customer address', withBillingEnv({}, () => {
  for (const value of [undefined, 'true', ' 1', '0']) {
    if (value === undefined) delete process.env.STRIPE_AUTOMATIC_TAX;
    else process.env.STRIPE_AUTOMATIC_TAX = value;
    assert.deepEqual(automaticTax(true), {}, JSON.stringify(value));
  }
  process.env.STRIPE_AUTOMATIC_TAX = '1';
  assert.deepEqual(automaticTax(false), { automatic_tax: { enabled: true } });
  assert.deepEqual(automaticTax(true), { automatic_tax: { enabled: true }, customer_update: { address: 'auto' } });
}));
