import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type Stripe from 'stripe';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';

// Real route + memory stores. Test-mode key; the cached Stripe client's Checkout methods are
// replaced and counted, so no request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
delete process.env.APP_URL;
delete process.env.PUBLIC_APP_URL;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';

const CONFIG = {
  STRIPE_WEBHOOK_SECRET: 'whsec_local_only',
  STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
  STRIPE_PRICE_PRO_ANNUAL: 'price_pro_annual',
} as const;

let stripeCalls = 0;
const sessionsApi = getStripe().checkout.sessions;
sessionsApi.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
  stripeCalls += 1;
  const id = `cs_test_${randomUUID()}`;
  return { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', expires_at: params.expires_at };
}) as unknown as typeof sessionsApi.create;
sessionsApi.retrieve = (async () => {
  stripeCalls += 1;
  throw new Error('retrieve is not expected in these tests');
}) as unknown as typeof sessionsApi.retrieve;

/** Runs with the full Stripe config, minus `unset`, plus `extra`; restores the env afterwards. */
async function withEnv(unset: readonly string[], extra: Record<string, string>, run: () => Promise<void>): Promise<void> {
  const keys = [...Object.keys(CONFIG), ...Object.keys(extra), 'NODE_ENV'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, CONFIG, extra);
  for (const k of unset) delete process.env[k];
  try { await run(); } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else Object.assign(process.env, { [k]: saved[k] }); }
  }
}

async function buyer(): Promise<{ userId: string; token: string }> {
  const account = await getStore().signIn(`gate-${randomUUID()}@checkout.test`);
  return { userId: account.userId, token: account.token };
}

async function startPro(token: string, interval: 'monthly' | 'annual'): Promise<{ status: number; error: unknown }> {
  const response = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'pro', interval }),
  }));
  const json: unknown = await response.json();
  assert.ok(json !== null && typeof json === 'object');
  return { status: response.status, error: 'error' in json ? json.error : undefined };
}

async function openIntent(userId: string): Promise<boolean> {
  const personal = (await getBillingStore().listWorkspaces(userId)).find((w) => w.type === 'personal');
  if (!personal) return false;
  return (await getBillingStore().pendingCheckout(userId, personal.id)) !== null;
}

test('checkout is refused with payments_not_open and no Stripe call when the webhook secret is missing', async () => {
  const me = await buyer();
  stripeCalls = 0;
  await withEnv(['STRIPE_WEBHOOK_SECRET'], {}, async () => {
    const res = await startPro(me.token, 'monthly');
    assert.deepEqual(res, { status: 503, error: 'payments_not_open' });
  });
  assert.equal(stripeCalls, 0);
  assert.equal(await openIntent(me.userId), false);
});

test('a missing annual price refuses checkout without leaving an open intent that blocks the next try', async () => {
  const me = await buyer();
  stripeCalls = 0;
  await withEnv(['STRIPE_PRICE_PRO_ANNUAL'], {}, async () => {
    const res = await startPro(me.token, 'annual');
    assert.equal(res.status, 503);
  });
  assert.equal(stripeCalls, 0);
  assert.equal(await openIntent(me.userId), false);
  await withEnv([], {}, async () => {
    assert.equal((await startPro(me.token, 'monthly')).status, 201);
  });
});

test('a missing APP_URL in production fails before an intent is created, so the retry succeeds', async () => {
  const me = await buyer();
  stripeCalls = 0;
  await withEnv([], { NODE_ENV: 'production' }, async () => {
    assert.equal((await startPro(me.token, 'annual')).status, 503);
  });
  assert.equal(stripeCalls, 0);
  assert.equal(await openIntent(me.userId), false);
  await withEnv([], { NODE_ENV: 'production', APP_URL: 'https://app.example.test' }, async () => {
    assert.equal((await startPro(me.token, 'monthly')).status, 201);
  });
  assert.equal(stripeCalls, 1);
});
