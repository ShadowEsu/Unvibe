import test from 'node:test';
import assert from 'node:assert/strict';
import { radioStep, radioTabStop } from '../src/renderer/companion/radioKeys';

const none = () => false;

test('arrows move to the next or previous option and wrap at the ends', () => {
  assert.equal(radioStep('ArrowDown', 0, 4, none), 1);
  assert.equal(radioStep('ArrowRight', 3, 4, none), 0);
  assert.equal(radioStep('ArrowUp', 0, 4, none), 3);
  assert.equal(radioStep('ArrowLeft', 2, 4, none), 1);
});

test('arrows skip options that are off (a wrong answer), and stay put when no other option is open', () => {
  const wrong = [1, 2];
  const off = (i: number) => wrong.includes(i);
  assert.equal(radioStep('ArrowDown', 0, 4, off), 3);
  assert.equal(radioStep('ArrowUp', 3, 4, off), 0);
  // From a wrong option that kept focus, the next open one.
  assert.equal(radioStep('ArrowDown', 1, 4, off), 3);
  assert.equal(radioStep('ArrowDown', 0, 2, (i) => i === 1), null);
  assert.equal(radioStep('ArrowDown', 0, 3, () => true), null);
});

test('Home and End go to the first and last open option without wrapping; other keys are not ours', () => {
  const off = (i: number) => i === 0 || i === 3;
  assert.equal(radioStep('Home', 2, 4, off), 1);
  assert.equal(radioStep('End', 1, 4, off), 2);
  assert.equal(radioStep('Enter', 1, 4, none), null);
  assert.equal(radioStep('2', 1, 4, none), null);
  assert.equal(radioStep('ArrowDown', 0, 0, none), null);
});

test('the one Tab stop sits on the preferred option, or the first open one when that is off or missing', () => {
  const off = (i: number) => i === 0;
  assert.equal(radioTabStop(2, 4, off), 2);
  assert.equal(radioTabStop(0, 4, off), 1);
  assert.equal(radioTabStop(null, 4, off), 1);
  assert.equal(radioTabStop(7, 4, none), 0);
  assert.equal(radioTabStop(null, 3, () => true), null);
});
