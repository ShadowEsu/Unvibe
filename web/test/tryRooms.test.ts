import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TRY_ROOMS, normalizeRoomCode, openRoom, roomBucket, roomCodeMac, type TryRoom } from '../src/lib/tryRooms';

const KEY = 'unit-room-key-0123456789abcdef0123456789abcdef';
const NOW = new Date('2026-11-03T18:30:00Z');
const room = (over: Partial<TryRoom> = {}): TryRoom => ({
  id: 'r1',
  codeMac: roomCodeMac('BLUEFOX42', KEY),
  start: '2026-11-03T18:00:00Z',
  end: '2026-11-03T20:00:00Z',
  perHour: 60,
  ...over,
});
/** Codes that appear in tests; no committed row may be their plain sha256. */
const TEST_CODES = ['BLUEFOX42', 'ROOMTEST1', 'ROOMTEST2', 'ABCD1234'];

test('a room opens for its code typed any way, only inside its window', () => {
  for (const typed of ['BLUEFOX42', 'bluefox42', ' Blue-Fox 42 ']) assert.equal(openRoom(typed, NOW, [room()], KEY)?.id, 'r1', typed);
  assert.equal(openRoom('BLUEFOX42', new Date('2026-11-03T17:59:59Z'), [room()], KEY), null);
  assert.equal(openRoom('BLUEFOX42', new Date('2026-11-03T20:00:00Z'), [room()], KEY), null);
  assert.equal(normalizeRoomCode(' Blue-Fox 42 '), 'BLUEFOX42');
});

test('without the key, or with a different key, the right code opens nothing (Security R-M1)', () => {
  assert.equal(openRoom('BLUEFOX42', NOW, [room()], null), null);
  assert.equal(openRoom('BLUEFOX42', NOW, [room()], 'another-key-0123456789abcdef0123456789'), null);
});

test('a row holding the plain sha256 of the code opens nothing', () => {
  const plain = room({ codeMac: createHash('sha256').update('BLUEFOX42').digest('hex') });
  assert.equal(openRoom('BLUEFOX42', NOW, [plain], KEY), null);
});

test('wrong codes, non-strings and codes outside 8 to 32 characters open nothing', () => {
  const short = room({ codeMac: roomCodeMac('BLUEFOX', KEY) });
  assert.equal(openRoom('BLUEFOX', NOW, [short], KEY), null);
  for (const code of ['BLUEFOX43', 'X'.repeat(33), 42, null, {}, ['BLUEFOX42']]) {
    assert.equal(openRoom(code, NOW, [room()], KEY), null, JSON.stringify(code));
  }
});

test('a row with a window over 3 hours, an end before its start, or a cap outside 1 to 60 opens nothing', () => {
  for (const bad of [
    { end: '2026-11-03T21:00:01Z' },
    { start: '2026-11-03T20:00:00Z', end: '2026-11-03T18:00:00Z' },
    { perHour: 0 },
    { perHour: 61 },
    { perHour: 2.5 },
    { start: 'not a date' },
  ]) {
    assert.equal(openRoom('BLUEFOX42', NOW, [room(bad)], KEY), null, JSON.stringify(bad));
  }
});

test('the room bucket has the shape reserve_try_request requires and is per room', () => {
  assert.match(roomBucket(room()), /^[0-9a-f]{32}$/);
  assert.notEqual(roomBucket(room()), roomBucket(room({ id: 'r2' })));
});

test('every committed room row is valid and holds a keyed MAC, not a plain hash of a known code', () => {
  const plain = new Set(TEST_CODES.map((code) => createHash('sha256').update(code).digest('hex')));
  for (const row of TRY_ROOMS) {
    assert.match(row.codeMac, /^[0-9a-f]{64}$/, row.id);
    assert.ok(!plain.has(row.codeMac), row.id);
    const span = Date.parse(row.end) - Date.parse(row.start);
    assert.ok(span > 0 && span <= 3 * 3_600_000, row.id);
    assert.ok(Number.isInteger(row.perHour) && row.perHour >= 1 && row.perHour <= 60, row.id);
  }
});
