import test from 'node:test';
import assert from 'node:assert/strict';
import { batchEvents, EVENT_PUSH_BATCH_SIZE, mergeRemoteEvents, retryDelayMs } from '../src/core/syncModel';
import type { LocalEvent } from '../src/core/learning';

function event(id: string, outcome: LocalEvent['outcome'] = 'reviewed'): LocalEvent {
  return { id, ts: `2026-07-${id === 'a' ? '10' : '11'}T10:00:00Z`, scope: 'selection', level: 'intermediate', outcome, lines: 4 };
}

test('retry uses bounded exponential backoff with jitter', () => {
  assert.equal(retryDelayMs(0, 0), 1_000);
  assert.equal(retryDelayMs(2, 0.5), 4_400);
  assert.equal(retryDelayMs(20, 1), 72_000);
});

test('event batches never exceed the backend per-request cap', () => {
  const ids = Array.from({ length: EVENT_PUSH_BATCH_SIZE * 2 + 7 }, (_, i) => `evt-${i}`);
  const batches = batchEvents(ids);
  assert.equal(batches.length, 3);
  for (const batch of batches) {
    assert.ok(batch.length <= EVENT_PUSH_BATCH_SIZE);
  }
  assert.equal(batches.flat().length, ids.length);
  assert.deepEqual(batches[0], ids.slice(0, EVENT_PUSH_BATCH_SIZE));
  assert.deepEqual(batches[1], ids.slice(EVENT_PUSH_BATCH_SIZE, EVENT_PUSH_BATCH_SIZE * 2));
});

test('a single small batch is returned untouched', () => {
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(batchEvents(ids), [ids]);
  assert.deepEqual(batchEvents([]), []);
});

test('remote merge adds records and replaces already-synced copies', () => {
  const result = mergeRemoteEvents([event('a')], [], [event('a', 'understood'), event('b')]);
  assert.equal(result.merged, 2);
  assert.equal(result.events.find((item) => item.id === 'a')?.outcome, 'understood');
  assert.deepEqual(result.events.map((item) => item.id), ['a', 'b']);
});

test('remote merge preserves a newer local event still in the outbox', () => {
  const result = mergeRemoteEvents([event('a', 'needs_review')], ['a'], [event('a', 'reviewed')]);
  assert.equal(result.merged, 0);
  assert.equal(result.events[0].outcome, 'needs_review');
});

test('remote merge keeps local lesson bodies when the cloud mirror has none', () => {
  const local: LocalEvent = { ...event('a', 'understood'), code: 'x = 1', explanation: 'Sets x.' };
  const result = mergeRemoteEvents([local], [], [event('a', 'understood')]);
  assert.equal(result.events[0]!.code, 'x = 1');
  assert.equal(result.events[0]!.explanation, 'Sets x.');
});
