import test from 'node:test';
import assert from 'node:assert/strict';
import { revealInitialState } from '../src/core/reveal';

test('reduced motion reveals full text instantly, no animation', () => {
  const s = revealInitialState(true, 'streaming', 'hello world');
  assert.equal(s.animate, false);
  assert.equal(s.initial, 'hello world');
});

test('streaming without reduced motion animates from empty', () => {
  const s = revealInitialState(false, 'streaming', 'hello');
  assert.equal(s.animate, true);
  assert.equal(s.initial, '');
});

test('non-streaming phases reset revealed text', () => {
  const s = revealInitialState(false, 'ready', '');
  assert.equal(s.animate, false);
  assert.equal(s.initial, '');
});

test('empty text never animates', () => {
  const s = revealInitialState(false, 'done', '');
  assert.equal(s.animate, false);
  assert.equal(s.initial, '');
});
