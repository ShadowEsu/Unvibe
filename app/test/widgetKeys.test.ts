import test from 'node:test';
import assert from 'node:assert/strict';
import { widgetKeyAction, type WidgetKeyInput } from '../src/core/widgetKeys';

function input(patch: Partial<WidgetKeyInput>): WidgetKeyInput {
  return { key: 'x', metaKey: false, ctrlKey: false, inFormField: false, ...patch };
}

test('close fires on CommandOrControl+W on any platform', () => {
  assert.deepEqual(widgetKeyAction(input({ key: 'w', metaKey: true })), { kind: 'close' });
  assert.deepEqual(widgetKeyAction(input({ key: 'w', ctrlKey: true })), { kind: 'close' });
});

test('close stays active while typing in a form field', () => {
  assert.deepEqual(widgetKeyAction(input({ key: 'w', metaKey: true, inFormField: true })), { kind: 'close' });
});

test('level pick maps keys 1-5 to the level index', () => {
  assert.deepEqual(widgetKeyAction(input({ key: '1', metaKey: true })), { kind: 'pick-level', levelIndex: 0 });
  assert.deepEqual(widgetKeyAction(input({ key: '3', metaKey: true })), { kind: 'pick-level', levelIndex: 2 });
  assert.deepEqual(widgetKeyAction(input({ key: '5', ctrlKey: true })), { kind: 'pick-level', levelIndex: 4 });
});

test('level pick is suppressed while typing in a form field', () => {
  assert.deepEqual(widgetKeyAction(input({ key: '2', metaKey: true, inFormField: true })), { kind: 'none' });
});

test('Escape collapses, but never while typing in a form field', () => {
  assert.deepEqual(widgetKeyAction(input({ key: 'Escape' })), { kind: 'toggle-collapse' });
  assert.deepEqual(widgetKeyAction(input({ key: 'Escape', inFormField: true })), { kind: 'none' });
});

test('unrelated keys and out-of-range level keys do nothing', () => {
  assert.deepEqual(widgetKeyAction(input({ key: 'Enter' })), { kind: 'none' });
  assert.deepEqual(widgetKeyAction(input({ key: '6', metaKey: true })), { kind: 'none' });
  assert.deepEqual(widgetKeyAction(input({ key: 'a', ctrlKey: true })), { kind: 'none' });
});
