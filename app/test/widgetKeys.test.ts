import test from 'node:test';
import assert from 'node:assert/strict';
import { widgetKeyAction } from '../src/core/widgetKeys';

test('Command/Control+W closes the widget on both platforms', () => {
  assert.deepEqual(widgetKeyAction({ key: 'w', metaKey: true, ctrlKey: false, inFormField: false }), { type: 'close-widget' });
  assert.deepEqual(widgetKeyAction({ key: 'w', metaKey: false, ctrlKey: true, inFormField: false }), { type: 'close-widget' });
});

test('Command+W still closes the widget while typing in a form field', () => {
  assert.deepEqual(widgetKeyAction({ key: 'w', metaKey: true, inFormField: true }), { type: 'close-widget' });
});

test('Escape collapses the panel outside form fields', () => {
  assert.deepEqual(widgetKeyAction({ key: 'Escape', inFormField: false }), { type: 'collapse' });
});

test('Escape is suppressed inside a form field so typing is not interrupted', () => {
  assert.deepEqual(widgetKeyAction({ key: 'Escape', inFormField: true }), { type: 'none' });
});

test('Command/Control+1..5 picks the matching depth level', () => {
  assert.deepEqual(widgetKeyAction({ key: '1', metaKey: true, inFormField: false }), { type: 'pick-level', level: 1 });
  assert.deepEqual(widgetKeyAction({ key: '3', ctrlKey: true, inFormField: false }), { type: 'pick-level', level: 3 });
  assert.deepEqual(widgetKeyAction({ key: '5', metaKey: true, inFormField: false }), { type: 'pick-level', level: 5 });
});

test('level picks are suppressed inside form fields', () => {
  assert.deepEqual(widgetKeyAction({ key: '2', metaKey: true, inFormField: true }), { type: 'none' });
});

test('unrelated and out-of-range keys do nothing', () => {
  assert.deepEqual(widgetKeyAction({ key: 'x', metaKey: true, inFormField: false }), { type: 'none' });
  assert.deepEqual(widgetKeyAction({ key: '6', metaKey: true, inFormField: false }), { type: 'none' });
  assert.deepEqual(widgetKeyAction({ key: 'w', metaKey: false, ctrlKey: false, inFormField: false }), { type: 'none' });
  assert.deepEqual(widgetKeyAction({ key: 'ArrowDown', inFormField: false }), { type: 'none' });
});
