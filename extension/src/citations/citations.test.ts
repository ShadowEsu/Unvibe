import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCitations, toSegments, stripMarkersForLive } from './citations';

test('parses single-line and range citations', () => {
  const text = 'See [[cite:src/a.ts:12]] and [[cite:src/b.ts:3-9]].';
  const cites = parseCitations(text);
  assert.equal(cites.length, 2);
  assert.deepEqual(cites[0], { file: 'src/a.ts', startLine: 12, endLine: undefined });
  assert.deepEqual(cites[1], { file: 'src/b.ts', startLine: 3, endLine: 9 });
});

test('toSegments verifies against provided files and flags unknown ones', () => {
  const known = new Set(['src/a.ts']);
  const segs = toSegments('x [[cite:src/a.ts:1]] y [[cite:ghost.ts:2]]', (f) => known.has(f));
  const cites = segs.filter((s) => s.type === 'cite') as Extract<typeof segs[number], { type: 'cite' }>[];
  assert.equal(cites[0].verified, true);
  assert.equal(cites[1].verified, false);
  // interleaved text preserved
  assert.equal(segs[0].type, 'text');
});

test('toSegments returns a single text segment when there are no citations', () => {
  const segs = toSegments('plain text', () => true);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].type, 'text');
});

test('stripMarkersForLive renders complete markers as basename:line', () => {
  assert.equal(stripMarkersForLive('the fn [[cite:src/math.ts:5-8]] adds'), 'the fn math.ts:5 adds');
});

test('stripMarkersForLive drops a trailing partial marker', () => {
  assert.equal(stripMarkersForLive('done [[cite:src/ma'), 'done ');
});
