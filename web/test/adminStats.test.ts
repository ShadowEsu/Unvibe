import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAdminStatsRequest, summarizeInstalls } from '../src/lib/adminStats';

const SECRET = 'a'.repeat(32);
const req = (auth?: string) => new Request('https://api.test/api/v1/admin/stats', { headers: auth ? { authorization: auth } : {} });

test('admin stats fails closed without a configured secret', () => {
  assert.equal(isAdminStatsRequest(req(`Bearer ${SECRET}`), undefined), false);
  assert.equal(isAdminStatsRequest(req('Bearer short'), 'short'), false);
});

test('admin stats accepts only the exact bearer token', () => {
  assert.equal(isAdminStatsRequest(req(`Bearer ${SECRET}`), SECRET), true);
  assert.equal(isAdminStatsRequest(req(`Bearer ${SECRET}x`), SECRET), false);
  assert.equal(isAdminStatsRequest(req(), SECRET), false);
});

test('summarizeInstalls counts new and active installs by window', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  const at = (iso: string) => ({ pathname: iso, uploadedAt: new Date(iso) });
  const installs = [at('2026-09-29T01:00:00Z'), at('2026-09-25T00:00:00Z'), at('2026-09-10T00:00:00Z'), at('2026-07-01T00:00:00Z')];
  const explanations = [at('2026-09-28T00:00:00Z'), at('2026-09-15T00:00:00Z')];
  assert.deepEqual(summarizeInstalls(installs, explanations, now), {
    installs: 4, newToday: 1, new7d: 2, new30d: 3, active7d: 1, active30d: 2,
  });
});
