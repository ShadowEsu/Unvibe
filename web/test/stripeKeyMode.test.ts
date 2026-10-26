import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { DELETE as deleteAccount } from '../app/api/v1/account/route';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { GET as status } from '../app/api/v1/billing/status/route';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { stagingConfig } from '../scripts/staging-guard';
import { getBillingStore } from '../src/billing/store';
import { checkoutOpen, getStripe, paymentsLocked } from '../src/billing/stripe';
import { stripeKeyMode } from '../src/billing/stripeKey';
import { getStore } from '../src/data/store';

// Fake key strings only. The client is built once with a well-formed test key and its methods are
// replaced and counted, so a rejected key that still reached the client would show up as a call.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.APP_URL;
delete process.env.PUBLIC_APP_URL;
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnlyNeverSent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual';

const client = getStripe();
let clientCalls = 0;
let liveStatus: 'active' | 'canceled' = 'active';
client.checkout.sessions.create = (async () => {
  clientCalls += 1;
  const id = `cs_test_${randomUUID()}`;
  return { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open' };
}) as unknown as typeof client.checkout.sessions.create;
client.checkout.sessions.retrieve = (async () => { clientCalls += 1; throw new Error('not expected'); }) as unknown as typeof client.checkout.sessions.retrieve;
client.subscriptions.retrieve = (async (id: string) => {
  clientCalls += 1;
  return { id, status: liveStatus, cancel_at_period_end: false, cancel_at: null, items: { data: [{ current_period_end: 1_800_000_000 }] } };
}) as unknown as typeof client.subscriptions.retrieve;

const VALID = { sk_test_abc123: 'test', rk_test_abc123: 'test', sk_live_abc123: 'live', rk_live_abc123: 'live', sk_test_51AbCdEf0123: 'test' } as const;
const REJECTED = [
  ' sk_test_abc123', 'sk_test_abc123 ', 'sk_test_abc123\n', 'sk_live_abc123\r\n', '\tsk_live_abc123', 'sk_test_ab\nc123', 'sk_test_ab c123',
  'sk_test_', 'sk_live_', 'rk_test_',
  'SK_TEST_abc123', 'SK_LIVE_abc123', 'Sk_live_abc123', 'sk_TEST_abc123', 'RK_LIVE_abc123',
  'pk_test_abc123', 'pk_live_abc123', 'sk_org_abc123', 'org_abc123',
  'sk_tes_abc123', 'sk_test-abc123', 'sk_test_abc-123', 'sk_test_abc_123', 'whsec_abc123', 'sk_test_abc123"', 'abc123', ' ',
];

const ENV = ['STRIPE_SECRET_KEY', 'VERCEL_ENV', 'BILLING_LIVE_PAYMENTS_APPROVED', 'BILLING_TEST_CHECKOUT_IN_PRODUCTION'] as const;
async function withEnv(values: Partial<Record<(typeof ENV)[number], string>>, run: () => Promise<void> | void): Promise<void> {
  const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  Object.assign(process.env, values);
  try { await run(); } finally {
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

/** Every switch that could open a key, all on. */
const EVERYTHING_APPROVED = { VERCEL_ENV: 'production', BILLING_LIVE_PAYMENTS_APPROVED: 'true', BILLING_TEST_CHECKOUT_IN_PRODUCTION: 'true' } as const;

async function subscriber(): Promise<string> {
  const account = await getStore().signIn(`key-${randomUUID()}@keys.test`);
  const workspace = await getBillingStore().ensurePersonalWorkspace(account.userId);
  await getBillingStore().syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `sub_${randomUUID()}`, stripePriceId: 'price_pro_monthly', cancelAtPeriodEnd: false,
  });
  return account.token;
}

test('the parser accepts only anchored, case-sensitive secret and restricted keys with a suffix', () => {
  for (const [key, mode] of Object.entries(VALID)) assert.equal(stripeKeyMode(key), mode, key);
  for (const key of REJECTED) assert.equal(stripeKeyMode(key), null, JSON.stringify(key));
  assert.equal(stripeKeyMode(undefined), null);
  assert.equal(stripeKeyMode(''), null);
});

test('a rejected key is closed everywhere, even with every approval set, and the client is never called', async () => {
  const token = await subscriber();
  for (const key of REJECTED) {
    const label = JSON.stringify(key);
    await withEnv({ STRIPE_SECRET_KEY: key, ...EVERYTHING_APPROVED }, async () => {
      clientCalls = 0;
      assert.equal(paymentsLocked(), true, label);
      assert.equal(checkoutOpen(), false, label);
      assert.deepEqual(await (await status()).json(), { paymentsOpen: false }, label);
      assert.throws(() => getStripe(), /Stripe is not configured/, label);
      const buy = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ plan: 'pro', interval: 'monthly' }),
      }));
      assert.equal(buy.status, 503, label);
      const hook = await webhook(new Request('http://localhost/api/v1/billing/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body: '{}' }));
      assert.deepEqual([hook.status, await hook.json()], [503, { error: 'webhook_not_configured' }], label);
      // Account deletion with a subscription must ask Stripe first; with no usable key nothing is deleted.
      const original = console.error;
      console.error = () => undefined;
      try {
        const removal = await deleteAccount(new Request('http://localhost/api/v1/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }));
        assert.equal(removal.status, 503, label);
      } finally {
        console.error = original;
      }
      assert.equal(clientCalls, 0, `${label}: no client call`);
    });
    assert.throws(() => stagingConfig({
      NODE_ENV: 'test', APP_ENV: 'staging', STAGING_CONFIRMATION: 'UNVIBE_STAGING_ONLY', SUPABASE_URL: 'https://stagingref.supabase.co', SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service', WEB_BASE_URL: 'https://staging.example.test', STAGING_PROJECT_REF: 'stagingref', STAGING_ALLOWED_SUPABASE_HOSTS: 'stagingref.supabase.co',
      STRIPE_SECRET_KEY: key,
    }), /not a test key/, label);
  }
});

test('valid keys open only where they did before', async () => {
  for (const key of ['sk_test_abc123', 'rk_test_abc123']) {
    await withEnv({ STRIPE_SECRET_KEY: key, VERCEL_ENV: 'preview' }, () => { assert.equal(checkoutOpen(), true, `${key} on a preview`); });
    await withEnv({ STRIPE_SECRET_KEY: key }, () => { assert.equal(checkoutOpen(), true, `${key} locally`); });
    await withEnv({ STRIPE_SECRET_KEY: key, VERCEL_ENV: 'production' }, () => { assert.equal(checkoutOpen(), false, `${key} on production`); });
    await withEnv({ STRIPE_SECRET_KEY: key, VERCEL_ENV: 'production', BILLING_TEST_CHECKOUT_IN_PRODUCTION: 'true' }, () => { assert.equal(checkoutOpen(), true, `${key} on production with the test flag`); });
  }
  for (const key of ['sk_live_abc123', 'rk_live_abc123']) {
    await withEnv({ STRIPE_SECRET_KEY: key, VERCEL_ENV: 'preview', BILLING_LIVE_PAYMENTS_APPROVED: 'true' }, () => { assert.equal(checkoutOpen(), false, `${key} on a preview`); });
    await withEnv({ STRIPE_SECRET_KEY: key, VERCEL_ENV: 'production' }, () => { assert.equal(checkoutOpen(), false, `${key} without approval`); });
    await withEnv({ STRIPE_SECRET_KEY: key, VERCEL_ENV: 'production', BILLING_LIVE_PAYMENTS_APPROVED: 'true' }, () => { assert.equal(checkoutOpen(), true, `${key} approved on production`); });
  }
});

test('a valid key on a locked deployment still serves an existing customer leaving', async () => {
  await withEnv({ STRIPE_SECRET_KEY: 'sk_live_abc123', VERCEL_ENV: 'production' }, async () => {
    assert.equal(paymentsLocked(), true);
    const token = await subscriber();
    clientCalls = 0;
    liveStatus = 'active';
    const blocked = await deleteAccount(new Request('http://localhost/api/v1/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }));
    assert.equal(blocked.status, 409, 'Stripe was asked and the subscription still charges');
    assert.equal(clientCalls, 1);
    liveStatus = 'canceled';
    const removed = await deleteAccount(new Request('http://localhost/api/v1/account', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }));
    assert.equal(removed.status, 200, 'canceled at Stripe: the account deletes');
  });
});
