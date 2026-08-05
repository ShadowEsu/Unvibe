import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRadioIndex } from '../src/core/rovingRadio';

test('radio roving index wraps forward and backward on the edges', () => {
  assert.equal(nextRadioIndex(0, 3, 'ArrowLeft'), 2);
  assert.equal(nextRadioIndex(0, 3, 'ArrowRight'), 1);
  assert.equal(nextRadioIndex(2, 3, 'ArrowRight'), 0);
  assert.equal(nextRadioIndex(2, 3, 'ArrowLeft'), 1);
});

test('radio roving index treats up as left and down as right', () => {
  assert.equal(nextRadioIndex(1, 3, 'ArrowUp'), 0);
  assert.equal(nextRadioIndex(1, 3, 'ArrowDown'), 2);
});

test('radio roving index jumps to Home and End', () => {
  assert.equal(nextRadioIndex(2, 3, 'Home'), 0);
  assert.equal(nextRadioIndex(0, 3, 'End'), 2);
});

test('radio roving index skips disabled radios', () => {
  const disabled = (index: number) => index === 1;
  assert.equal(nextRadioIndex(0, 3, 'ArrowRight', disabled), 2);
  assert.equal(nextRadioIndex(2, 3, 'ArrowLeft', disabled), 0);
  assert.equal(nextRadioIndex(1, 3, 'ArrowRight', disabled), 2);
});

test('radio roving index keeps current when every radio is disabled', () => {
  const disabled = () => true;
  assert.equal(nextRadioIndex(1, 3, 'ArrowRight', disabled), 1);
  assert.equal(nextRadioIndex(1, 3, 'Home', disabled), 0);
});

test('radio roving index guards empty and single-radio groups', () => {
  assert.equal(nextRadioIndex(0, 0, 'ArrowRight'), 0);
  assert.equal(nextRadioIndex(0, 0, 'Home'), 0);
  assert.equal(nextRadioIndex(0, 1, 'ArrowRight'), 0);
  assert.equal(nextRadioIndex(0, 1, 'ArrowLeft'), 0);
});
