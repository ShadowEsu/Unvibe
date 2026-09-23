import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore, SESSION_TTL_MS } from '../src/data/memoryStore';
import { SupabaseStore } from '../src/data/supabaseStore';
import { createStoreFromEnv } from '../src/data/store';
import { aiRequestRequiresSession } from '../src/lib/aiAccess';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { POST as refreshCheckout } from '../app/api/v1/billing/refresh/route';

test('revoking a session makes its bearer token unusable', async () => {
  const store = new MemoryStore();
  const account = await store.signIn(`logout-${crypto.randomUUID()}@example.test`);
  assert.equal(await store.userForToken(account.token), account.userId);

  await store.revokeToken(account.token);

  assert.equal(await store.userForToken(account.token), null);
});

test('production fails closed instead of silently using MemoryStore', () => {
  assert.throws(
    () => createStoreFromEnv({ NODE_ENV: 'production' }),
    /MemoryStore is disabled in production/,
  );
  assert.throws(
    () => createStoreFromEnv({ NODE_ENV: 'production', SUPABASE_URL: 'https://example.test' }),
    /partially configured/,
  );
});

test('MemoryStore requires an explicit production escape hatch', () => {
  const store = createStoreFromEnv({ NODE_ENV: 'production', UNCODE_ALLOW_MEMORY_STORE: 'true' });
  assert.match(store.kind, /memory/);
});

test('configured AI providers require a session while the development mock does not', () => {
  assert.equal(aiRequestRequiresSession(false), true);
  assert.equal(aiRequestRequiresSession(true), false);
});

test('duplicate device approval is idempotent and does not mint another token', async () => {
  const store = new MemoryStore();
  const device = await store.createDeviceCode('https://example.test');
  assert.match(device.userCode, /^[A-F0-9]{16}$/);
  const userId = crypto.randomUUID();
  const first = await store.approveDeviceCode(device.userCode, userId, 'device@example.test');
  const second = await store.approveDeviceCode(device.userCode, userId, 'device@example.test');
  assert.ok(first);
  assert.equal(second, first);
  assert.deepEqual(await store.redeemDeviceCode(device.deviceCode), { token: first });
  assert.equal(await store.redeemDeviceCode(device.deviceCode), 'used');
  assert.equal(await store.approveDeviceCode(device.userCode, userId), null);
});

test('expired device codes cannot be approved or redeemed', async () => {
  let now = 10_000;
  const store = new MemoryStore(() => now);
  const device = await store.createDeviceCode('https://example.test');
  now += 10 * 60_000 + 1;
  assert.equal(await store.approveDeviceCode(device.userCode, crypto.randomUUID()), null);
  assert.equal(await store.redeemDeviceCode(device.deviceCode), 'expired');
});

test('opaque sessions expire server-side', async () => {
  let now = 1_000;
  const store = new MemoryStore(() => now);
  const account = await store.signIn(`expiry-${crypto.randomUUID()}@example.test`);
  assert.equal(await store.userForToken(account.token), account.userId);
  now += SESSION_TTL_MS + 1;
  assert.equal(await store.userForToken(account.token), null);
});

test('persistent device redemption uses the atomic one-time RPC and rejects a replay', async () => {
  const requests: string[] = [];
  const token = crypto.randomUUID();
  let redeemed = false;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    assert.match(url, /\/rest\/v1\/rpc\/redeem_device_code$/);
    const row = redeemed
      ? { redeemed_token: null, redemption_status: 'used' }
      : { redeemed_token: token, redemption_status: 'approved' };
    redeemed = true;
    return new Response(JSON.stringify([row]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const store = new SupabaseStore('https://example.test', 'service-key', fetcher);
  const deviceCode = crypto.randomUUID();
  assert.deepEqual(await store.redeemDeviceCode(deviceCode), { token });
  assert.equal(await store.redeemDeviceCode(deviceCode), 'used');
  assert.equal(requests.length, 2);
});

test('persistent device approval fails closed on a database error', async () => {
  const store = new SupabaseStore('https://example.test', 'service-key', async () =>
    new Response(JSON.stringify({ message: 'database unavailable' }), {
      status: 503, headers: { 'content-type': 'application/json' },
    }),
  );
  await assert.rejects(store.approveDeviceCode('ABCD1234', crypto.randomUUID()), /Could not approve device authorization/);
});

test('checkout return cannot activate Pro without a completed webhook intent and entitlement', async () => {
  const account = await getStore().signIn(`checkout-${crypto.randomUUID()}@example.test`);
  const billing = getBillingStore();
  const workspace = await billing.ensurePersonalWorkspace(account.userId);
  const intent = await billing.createCheckoutIntent({
    userId: account.userId, workspaceId: workspace.id, plan: 'pro', interval: 'monthly', seats: 1,
  });
  const sessionId = `cs_${crypto.randomUUID()}`;
  await billing.attachCheckoutSession(intent.id, sessionId);
  const request = () => new Request('https://example.test/api/v1/billing/refresh', {
    method: 'POST', headers: { authorization: `Bearer ${account.token}` },
    body: JSON.stringify({ sessionId }),
  });
  assert.equal((await refreshCheckout(request())).status, 202);
  await billing.completeCheckoutIntent(sessionId);
  assert.equal((await refreshCheckout(request())).status, 202);
  await billing.syncSubscription({
    workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
    stripeCustomerId: 'cus_test', stripeSubscriptionId: 'sub_test', stripePriceId: 'price_test',
    cancelAtPeriodEnd: false,
  });
  const confirmed = await refreshCheckout(request());
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json() as { overview: { subscription: { plan: string } } }).overview.subscription.plan, 'pro');
});
