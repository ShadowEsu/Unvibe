import test from 'node:test';
import assert from 'node:assert/strict';
import { barPlacementAction } from '../src/core/barPlacement';

test('a bar position change resets the strip and repositions it', () => {
  assert.equal(barPlacementAction({ barPosition: 'bottom-center' }), 'reset-and-reposition');
});

test('following the active display ON repositions the strip', () => {
  assert.equal(barPlacementAction({ followActiveDisplay: true }), 'reposition');
});

test('turning follow-active-display OFF still repositions the strip', () => {
  assert.equal(barPlacementAction({ followActiveDisplay: false }), 'reposition');
});

test('a combined patch gives the position change precedence', () => {
  assert.equal(
    barPlacementAction({ barPosition: 'top-right', followActiveDisplay: false }),
    'reset-and-reposition',
  );
});

test('unrelated settings never move the strip', () => {
  assert.equal(barPlacementAction({ barHoverPreview: false }), 'none');
  assert.equal(barPlacementAction({ soundVolume: 0.5 }), 'none');
  assert.equal(barPlacementAction({}), 'none');
});
