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

test('duplicate device approval is idempotent and returns the same token', async () => {
  const store = new MemoryStore();
  const device = await store.createDeviceCode('https://example.test');
  const userId = crypto.randomUUID();
  const first = await store.approveDeviceCode(device.userCode, userId, 'device@example.test');
  const second = await store.approveDeviceCode(device.userCode, userId, 'device@example.test');
  assert.ok(first);
  assert.equal(second, first);
  assert.deepEqual(await store.redeemDeviceCode(device.deviceCode), { token: first });
  assert.equal(await store.approveDeviceCode(device.userCode, crypto.randomUUID()), null);
});

test('unknown device code cannot be approved or redeemed', async () => {
  const store = new MemoryStore();
  assert.equal(await store.approveDeviceCode('NONEXIST', crypto.randomUUID()), null);
  assert.equal(await store.redeemDeviceCode('unknown-code'), 'unknown');
});

test('device code lifecycle tracks approval state', async () => {
  const store = new MemoryStore();
  const device = await store.createDeviceCode('https://example.test');
  assert.deepEqual(await store.redeemDeviceCode(device.deviceCode), 'pending');
  const userId = crypto.randomUUID();
  const token = await store.approveDeviceCode(device.userCode, userId, 'test@example.test');
  assert.ok(token);
  assert.deepEqual(await store.redeemDeviceCode(device.deviceCode), { token });
});

test('tokens survive across sessions until revoked', async () => {
  const store = new MemoryStore();
  const account = await store.signIn(`persist-${crypto.randomUUID()}@example.test`);
  assert.equal(await store.userForToken(account.token), account.userId);
  assert.equal(await store.userForToken(account.token), account.userId);
  await store.revokeToken(account.token);
  assert.equal(await store.userForToken(account.token), null);
});
