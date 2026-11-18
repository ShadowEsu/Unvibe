import test from 'node:test';
import assert from 'node:assert/strict';
import { clampSpot, islandWindowAt, keepOnDisplays, pillSpotIn, rendererSettingsPatch, savedSpot, snapSpot, withSpot } from '../src/main/spots';
import { arrowStep, pastDragThreshold } from '../src/renderer/shared/windowDrag';

const laptop = { x: 0, y: 25, width: 1440, height: 875 };
const external = { x: 1440, y: -200, width: 2560, height: 1415 };
const panel = { width: 320, height: 360 };
const pill = { width: 184, height: 38 };

test('a saved spot dragged past the edge comes back 12 px inside the work area', () => {
  assert.deepEqual(clampSpot({ x: -400, y: 5000 }, panel, laptop), { x: 12, y: 25 + 875 - 360 - 12 });
  assert.deepEqual(clampSpot({ x: 2000, y: -90 }, panel, laptop), { x: 1440 - 320 - 12, y: 37 });
  assert.deepEqual(clampSpot({ x: 600.4, y: 300.6 }, panel, laptop), { x: 600, y: 301 });
});

test('each display keeps its own spot; a spot for a display that is gone is not used (Security A3)', () => {
  let spots = withSpot(undefined, 1, { x: 100, y: 200 });
  spots = withSpot(spots, 2, { x: 2000, y: 100 });
  assert.deepEqual(savedSpot(spots, 1, panel, laptop), { x: 100, y: 200 });
  assert.deepEqual(savedSpot(spots, 2, panel, external), { x: 2000, y: 100 });
  assert.equal(savedSpot(spots, 3, panel, laptop), null);
  // A spot saved on a larger screen than the one now under that id still lands on it.
  assert.deepEqual(savedSpot(withSpot(undefined, 1, { x: 3000, y: 1400 }), 1, panel, laptop), { x: 1108, y: 528 });
  assert.equal(savedSpot({ 1: { x: Number.NaN, y: 0 } }, 1, panel, laptop), null, 'a corrupt spot falls back to the default');
});

test('a spot on disk that is not an object with finite x and y is ignored', () => {
  for (const bad of [5, 'x', null, true, [], { x: Infinity, y: 0 }, { x: 0, y: -Infinity }, { x: Number.NaN, y: 1 }, { x: '5', y: 5 }, { y: 5 }]) {
    assert.equal(savedSpot({ 1: bad } as never, 1, panel, laptop), null, String(JSON.stringify(bad)));
  }
  assert.equal(savedSpot('{"1":{"x":1,"y":2}}' as never, 1, panel, laptop), null, 'a string where the spots belong');
  assert.equal(savedSpot(42 as never, 1, panel, laptop), null);
});

test('a page can\'t write window spots through settings:set, and a new Island position forgets the Island\'s spots', () => {
  const spots = { 1: { x: 1, y: 2 } };
  assert.deepEqual(rendererSettingsPatch({ overlaySpots: spots, islandSpots: spots, theme: 'dark' }), { theme: 'dark' });
  assert.deepEqual(rendererSettingsPatch({ barPosition: 'bottom-right', islandSpots: spots }), { barPosition: 'bottom-right', islandSpots: undefined });
  assert.deepEqual(rendererSettingsPatch({ barSize: 'large' }), { barSize: 'large' }, 'other changes keep the Island where it is');
  assert.deepEqual(rendererSettingsPatch(null), {});
});

test('a dragged window\'s centre stays on a display: it crosses between touching ones, and comes back from a gap', () => {
  const displays = [laptop, external];
  const tall = { width: 320, height: 400 };
  assert.deepEqual(keepOnDisplays({ x: 1300, y: 100 }, tall, displays), { x: 1300, y: 100 }, 'centre on the external display');
  assert.deepEqual(keepOnDisplays({ x: 1280, y: 100 }, tall, displays), { x: 1280, y: 100 }, 'centre on the edge both share');
  // Below the laptop, beside the taller external display: off every screen, so it comes back to the nearer one.
  assert.deepEqual(keepOnDisplays({ x: 840, y: 900 }, tall, displays), { x: 840, y: 700 });
  assert.deepEqual(keepOnDisplays({ x: -9000, y: -9000 }, tall, displays), { x: -160, y: 25 - 200 });
});

test('forgetting one display\'s spot (double-click) leaves the others', () => {
  const spots = withSpot(withSpot(undefined, 1, { x: 1, y: 2 }), 2, { x: 3, y: 4 });
  assert.deepEqual(withSpot(spots, 1, null), { 2: { x: 3, y: 4 } });
  assert.deepEqual(spots, { 1: { x: 1, y: 2 }, 2: { x: 3, y: 4 } }, 'the stored object is not changed in place');
});

test('a window dropped within 18 px of an edge lines up with the 12 px margin; further in, it stays put', () => {
  assert.deepEqual(snapSpot({ x: 20, y: 400 }, panel, laptop), { x: 12, y: 400 });
  assert.deepEqual(snapSpot({ x: 1440 - 320 - 20, y: 25 + 875 - 360 - 3 }, panel, laptop), { x: 1108, y: 528 });
  assert.deepEqual(snapSpot({ x: 31, y: 56 }, panel, laptop), { x: 31, y: 56 });
});

test('the floating Island opens toward the middle of the screen and its pill stays where it was left', () => {
  const card = { width: 372, height: 300 };
  const low = islandWindowAt({ x: 600, y: 800 }, pill, card, laptop);
  assert.equal(low.opensUp, true);
  assert.equal(low.y + low.height, 800 + 38, 'the pill is the bottom of the window');
  assert.deepEqual(pillSpotIn(low, pill, low.opensUp), { x: 600, y: 800 });
  const high = islandWindowAt({ x: 600, y: 60 }, pill, card, laptop);
  assert.equal(high.opensUp, false);
  assert.deepEqual(pillSpotIn(high, pill, high.opensUp), { x: 600, y: 60 });
  // Near a side the card shifts to stay on screen instead of hanging off it.
  const side = islandWindowAt({ x: 1440 - 184 - 12, y: 60 }, pill, card, laptop);
  assert.equal(side.x + side.width, 1440 - 12);
});

test('a press becomes a drag only after 4 px of travel; arrows move by one step on one axis', () => {
  assert.equal(pastDragThreshold(3, 2), false);
  assert.equal(pastDragThreshold(0, 4), true);
  assert.deepEqual(arrowStep('ArrowLeft'), { dx: -1, dy: 0 });
  assert.deepEqual(arrowStep('ArrowDown'), { dx: 0, dy: 1 });
  assert.equal(arrowStep('Enter'), null);
});
