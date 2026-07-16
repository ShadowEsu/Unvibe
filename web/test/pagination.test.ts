import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/data/memoryStore';
import { decodeHistoryCursor, encodeHistoryCursor } from '../src/data/pagination';

test('history cursors round-trip and reject malformed values', () => {
  const cursor = { ts: '2026-07-15T12:00:00.000Z', id: 'event-10' };
  assert.deepEqual(decodeHistoryCursor(encodeHistoryCursor(cursor)), cursor);
  assert.equal(decodeHistoryCursor('not-a-cursor'), undefined);
});

test('cursor pagination restores more than the former 500-record cap without gaps', async () => {
  const store = new MemoryStore();
  const userId = crypto.randomUUID();
  const events = Array.from({ length: 1_203 }, (_, index) => ({
    id: `${userId}-${index.toString().padStart(4, '0')}`,
    ts: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(index / 3))).toISOString(),
    scope: 'selection',
    level: 'intermediate',
    outcome: 'reviewed' as const,
  }));
  await store.upsertEvents(userId, events);

  const restored: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.historyPage(userId, 137, cursor);
    restored.push(...page.events.map((event) => event.id));
    cursor = page.nextCursor;
  } while (cursor);

  assert.equal(restored.length, events.length);
  assert.equal(new Set(restored).size, events.length);
  assert.deepEqual(restored, [...restored].sort().reverse());
});
