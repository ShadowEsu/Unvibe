import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyActivation, isAdminStatsRequest, summarizeInstalls } from '../src/lib/adminStats';
import { activationKind, FIRST_RUN_SAMPLE } from '../src/lib/activation';

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
  const at = (iso: string) => new Date(iso);
  const installs = [at('2026-09-29T01:00:00Z'), at('2026-09-25T00:00:00Z'), at('2026-09-10T00:00:00Z'), at('2026-07-01T00:00:00Z')];
  const explanations = [at('2026-09-28T00:00:00Z'), at('2026-09-15T00:00:00Z')];
  assert.deepEqual(summarizeInstalls(5, installs, explanations, now), {
    installs: 5, newToday: 1, new7d: 2, new30d: 3, active7d: 1, active30d: 2,
  });
});

test('daily activation counts each install once per marker and splits sample from own code', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  const at = (iso: string) => new Date(iso);
  const rows = dailyActivation(
    [at('2026-10-18T01:00:00Z'), at('2026-10-17T23:59:59Z'), at('2026-09-01T00:00:00Z')],
    [{ kind: 'sample', at: at('2026-10-18T01:00:05Z') },
     { kind: 'code', at: at('2026-10-18T02:00:00Z') },
     { kind: 'sample', at: at('2026-10-18T00:00:01Z') }],
    now, 2,
  );
  assert.deepEqual(rows, [
    { day: '2026-10-17', installs: 1, sample: 0, code: 0 },
    { day: '2026-10-18', installs: 1, sample: 2, code: 1 },
  ]);
});

test('only the built-in first-run sample counts as the sample, whatever its line endings', () => {
  assert.equal(activationKind(FIRST_RUN_SAMPLE.replace(/\n/g, '\r\n') + '\n'), 'sample');
  assert.equal(activationKind(FIRST_RUN_SAMPLE.replace('wait);', 'wait * 2);')), 'code');
  assert.equal(activationKind(undefined), 'code');
});
