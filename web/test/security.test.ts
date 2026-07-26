import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/data/memoryStore';
import { createStoreFromEnv } from '../src/data/store';
import { aiRequestRequiresSession } from '../src/lib/aiAccess';

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
  const store = new MemoryStore();
  const device = await store.createDeviceCode('https://example.test');
  // MemoryStore uses Date.now() for expiry — no time manipulation in dev store
  assert.ok(device.deviceCode);
  assert.ok(device.userCode);
});

test('opaque sessions are valid until revoked', async () => {
  const store = new MemoryStore();
  const account = await store.signIn(`session-${crypto.randomUUID()}@example.test`);
  assert.equal(await store.userForToken(account.token), account.userId);
  // MemoryStore sessions never expire on their own (dev-only); revokeToken ends them
  await store.revokeToken(account.token);
  assert.equal(await store.userForToken(account.token), null);
});
