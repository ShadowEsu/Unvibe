import test from 'node:test';
import assert from 'node:assert/strict';
import { barPlacementAction } from '../src/core/barPlacement';

test('barPosition change resets and repositions the bar', () => {
  assert.deepEqual(barPlacementAction({ barPosition: 'bottom-right' }), {
    kind: 'reset-and-reposition',
  });
});

test('followActiveDisplay toggled ON repositions the bar', () => {
  assert.deepEqual(barPlacementAction({ followActiveDisplay: true }), { kind: 'reposition' });
});

test('followActiveDisplay toggled OFF repositions the bar', () => {
  assert.deepEqual(barPlacementAction({ followActiveDisplay: false }), { kind: 'reposition' });
});

test('unrelated patch fields do not move the bar', () => {
  assert.deepEqual(barPlacementAction({ barHoverPreview: false }), { kind: 'none' });
  assert.deepEqual(barPlacementAction({}), { kind: 'none' });
});

test('barPosition wins over followActiveDisplay when both change', () => {
  assert.deepEqual(
    barPlacementAction({ barPosition: 'top-right', followActiveDisplay: false }),
    { kind: 'reset-and-reposition' },
  );
});
