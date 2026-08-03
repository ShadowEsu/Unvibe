import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTabbable, FOCUSABLE_SELECTOR } from '../src/renderer/shared/focusTrap';

function el(id: string): { id: string; focus(): void } & { dataset: { testId?: string } } {
  const element: { id: string; focus(): void } & { dataset: { testId?: string } } = {
    id,
    focus() {},
    dataset: {},
  };
  element.dataset.testId = id;
  return element;
}

const a = el('a');
const b = el('b');
const c = el('c');
const list = [a, b, c];

test('selector covers the interactive controls used in the companion renderer', () => {
  assert.ok(FOCUSABLE_SELECTOR.includes('button:not([disabled]):not([hidden])'));
  assert.ok(FOCUSABLE_SELECTOR.includes('input:not([disabled]):not([hidden])'));
  assert.ok(FOCUSABLE_SELECTOR.includes('select:not([disabled]):not([hidden])'));
  assert.ok(FOCUSABLE_SELECTOR.includes('textarea:not([disabled]):not([hidden])'));
});

test('empty list never returns an element', () => {
  assert.equal(nextTabbable([], a, false), null);
  assert.equal(nextTabbable([], null, false), null);
});

test('forward tab cycles forward and wraps to the first element', () => {
  assert.equal(nextTabbable(list, a, false), b);
  assert.equal(nextTabbable(list, b, false), c);
  assert.equal(nextTabbable(list, c, false), a);
});

test('shift+tab cycles backward and wraps to the last element', () => {
  assert.equal(nextTabbable(list, a, true), c);
  assert.equal(nextTabbable(list, b, true), a);
  assert.equal(nextTabbable(list, c, true), b);
});

test('an unfocused root starts forward tab at the first element and shift+tab at the last', () => {
  assert.equal(nextTabbable(list, null, false), a);
  assert.equal(nextTabbable(list, null, true), c);
});
