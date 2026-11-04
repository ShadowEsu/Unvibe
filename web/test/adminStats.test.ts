import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyActivation, isAdminStatsRequest, openDisputes, summarizeInstalls } from '../src/lib/adminStats';
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
    [{ installKey: 'a', kind: 'sample', at: at('2026-10-18T01:00:05Z') },
     { installKey: 'a', kind: 'code', at: at('2026-10-18T02:00:00Z') },
     { installKey: 'b', kind: 'sample', at: at('2026-10-18T00:00:01Z') }],
    now, 2,
  );
  assert.deepEqual(rows, [
    { day: '2026-10-17', installs: 1, sample: 0, code: 0, first: 0 },
    { day: '2026-10-18', installs: 1, sample: 2, code: 1, first: 2 },
  ]);
});

test('daily activation ignores the funnel kinds, so its output is unchanged by them', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  const at = (iso: string) => new Date(iso);
  const base = [{ installKey: 'a', kind: 'sample', at: at('2026-10-18T01:00:05Z') }, { installKey: 'a', kind: 'code', at: at('2026-10-18T02:00:00Z') }];
  const funnel = ['onboarded', 'accessibility', 'signed_in', 'return', 'accessibility_asked', 'level_answered', 'login_prompt_shown', 'login_prompt_accepted']
    .map((kind) => ({ installKey: 'c', kind, at: at('2026-10-18T03:00:00Z') }));
  const installs = [at('2026-10-18T01:00:00Z')];
  const withFunnel = dailyActivation(installs, [...base, ...funnel], now, 2);
  assert.deepEqual(withFunnel, dailyActivation(installs, base, now, 2));
  for (const row of withFunnel) assert.deepEqual(Object.keys(row), ['day', 'installs', 'sample', 'code', 'first']);
});

test('first explanations: each install once, on the day of its earliest sample or own-code marker', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const at = (iso: string) => new Date(iso);
  const rows = dailyActivation([], [
    // Sample on the 18th, own code on the 19th: first on the 18th only.
    { installKey: 'a', kind: 'code', at: at('2026-10-19T09:00:00Z') },
    { installKey: 'a', kind: 'sample', at: at('2026-10-18T09:00:00Z') },
    // Own code first (skipped the sample).
    { installKey: 'b', kind: 'code', at: at('2026-10-20T01:00:00Z') },
    // Explained before the window (its sample marker is older), so its code marker is not a first.
    { installKey: 'old', kind: 'code', at: at('2026-10-19T10:00:00Z') },
    // Progress markers never make a first.
    { installKey: 'd', kind: 'onboarded', at: at('2026-10-19T10:00:00Z') },
  ], now, 3, new Set(['old']));
  assert.deepEqual(rows.map((row) => [row.day, row.first, row.sample, row.code]), [
    ['2026-10-18', 1, 1, 0],
    ['2026-10-19', 0, 0, 2],
    ['2026-10-20', 1, 0, 1],
  ]);
});

test('only the built-in first-run sample counts as the sample, whatever its line endings', () => {
  assert.equal(activationKind(FIRST_RUN_SAMPLE.replace(/\n/g, '\r\n') + '\n'), 'sample');
  assert.equal(activationKind(FIRST_RUN_SAMPLE.replace('wait);', 'wait * 2);')), 'code');
  assert.equal(activationKind(undefined), 'code');
});

test('open disputes are the opened ones not yet closed, with the nearest evidence deadline first', () => {
  const rows = [
    { action: 'dispute.opened', metadata: { disputeId: 'dp_won', dueBy: '2026-10-25T00:00:00.000Z' } },
    { action: 'dispute.opened', metadata: { disputeId: 'dp_late', dueBy: '2026-11-02T00:00:00.000Z' } },
    { action: 'dispute.opened', metadata: { disputeId: 'dp_soon', dueBy: '2026-10-28T00:00:00.000Z' } },
    { action: 'dispute.closed', metadata: { disputeId: 'dp_won', status: 'won' } },
    // Replayed audit rows for one dispute count once.
    { action: 'dispute.opened', metadata: { disputeId: 'dp_soon', dueBy: '2026-10-28T00:00:00.000Z' } },
  ];
  assert.deepEqual(openDisputes(rows), { disputesOpen: 2, disputeNextDueBy: '2026-10-28T00:00:00.000Z' });
  assert.deepEqual(openDisputes([]), { disputesOpen: 0, disputeNextDueBy: null });
});
