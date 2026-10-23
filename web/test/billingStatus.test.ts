import assert from 'node:assert/strict';
import test from 'node:test';
import { GET as status } from '../app/api/v1/billing/status/route';

// unvibe.site reads this to decide whether its pricing copy may promise checkout. It must say
// exactly what checkout does, need no sign-in, and carry nothing beyond the one boolean.
const STRIPE_ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_ANNUAL', 'BILLING_LIVE_PAYMENTS_APPROVED', 'BILLING_TEST_CHECKOUT_IN_PRODUCTION', 'VERCEL_ENV'] as const;
const CONFIGURED = { STRIPE_WEBHOOK_SECRET: 'whsec_fake', STRIPE_PRICE_PRO_MONTHLY: 'price_pm', STRIPE_PRICE_PRO_ANNUAL: 'price_pa' };

async function statusWith(values: Partial<Record<(typeof STRIPE_ENV)[number], string>>) {
  const saved = Object.fromEntries(STRIPE_ENV.map((k) => [k, process.env[k]]));
  for (const k of STRIPE_ENV) delete process.env[k];
  Object.assign(process.env, values);
  try {
    const res = await status();
    return { res, body: await res.json() as Record<string, unknown> };
  } finally {
    for (const k of STRIPE_ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test('billing status is closed under a live key until payments are approved on production', async () => {
  assert.deepEqual((await statusWith({ ...CONFIGURED, STRIPE_SECRET_KEY: 'sk_live_fake', VERCEL_ENV: 'production' })).body, { paymentsOpen: false });
  assert.deepEqual((await statusWith({ ...CONFIGURED, STRIPE_SECRET_KEY: 'sk_live_fake', VERCEL_ENV: 'production', BILLING_LIVE_PAYMENTS_APPROVED: 'true' })).body, { paymentsOpen: true });
  assert.deepEqual((await statusWith({ ...CONFIGURED, STRIPE_SECRET_KEY: 'sk_live_fake', VERCEL_ENV: 'preview', BILLING_LIVE_PAYMENTS_APPROVED: 'true' })).body, { paymentsOpen: false });
});

test('billing status is closed for a test key on the production deployment only', async () => {
  assert.deepEqual((await statusWith({ ...CONFIGURED, STRIPE_SECRET_KEY: 'sk_test_fake', VERCEL_ENV: 'production' })).body, { paymentsOpen: false });
  assert.deepEqual((await statusWith({ ...CONFIGURED, STRIPE_SECRET_KEY: 'sk_test_fake', VERCEL_ENV: 'production', BILLING_TEST_CHECKOUT_IN_PRODUCTION: 'true' })).body, { paymentsOpen: true });
  assert.deepEqual((await statusWith({ ...CONFIGURED, STRIPE_SECRET_KEY: 'sk_test_fake', VERCEL_ENV: 'preview' })).body, { paymentsOpen: true });
});

test('billing status is closed when Stripe is not configured', async () => {
  assert.deepEqual((await statusWith({})).body, { paymentsOpen: false });
  assert.deepEqual((await statusWith({ STRIPE_SECRET_KEY: 'sk_test_fake' })).body, { paymentsOpen: false }, 'a key without prices or webhook secret');
});

test('billing status needs no sign-in and is publicly cacheable for five minutes', async () => {
  const { res } = await statusWith({ ...CONFIGURED, STRIPE_SECRET_KEY: 'sk_live_fake' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, s-maxage=300');
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);
});
