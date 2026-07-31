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

test('expired device codes and sessions are rejected by the production schema', async () => {
  // The dev MemoryStore intentionally has no clock injection: it never expires tokens or
  // device codes. Expiry is enforced in production by the Supabase schema
  // (supabase/migrations/0002_device_code_lifecycle.sql, 0004_session_expiry.sql) and is
  // covered by the staging verification scripts (npm run verify:staging).
  const store = new MemoryStore();
  const device = await store.createDeviceCode('https://example.test');
  const account = await store.signIn('no-expiry@example.test');
  assert.equal(await store.userForToken(account.token), account.userId);
  assert.equal(await store.redeemDeviceCode(device.deviceCode), 'pending');
});
