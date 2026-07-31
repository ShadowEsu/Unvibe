import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAccelerator } from '../src/core/accelerator';

test('default macOS shortcut renders without a stray separator', () => {
  assert.equal(formatAccelerator('CommandOrControl+U'), '⌘U');
});

test('modifier order and separators are stripped consistently', () => {
  assert.equal(formatAccelerator('CommandOrControl+Shift+U'), '⌘⇧U');
  assert.equal(formatAccelerator('CommandOrControl+Alt+Shift+P'), '⌘⌥⇧P');
});

test('bare Control (non-Apple) modifier is rendered', () => {
  assert.equal(formatAccelerator('Control+Shift+K'), '⌃⇧K');
});

test('space key shortcut is preserved', () => {
  assert.equal(formatAccelerator('CommandOrControl+Space'), '⌘Space');
});

test('every surface renders the same string for a given shortcut', () => {
  const cases = [
    'CommandOrControl+U',
    'CommandOrControl+Shift+U',
    'Control+Shift+K',
    'Alt+Shift+P',
    'CommandOrControl+Space',
  ];
  for (const accel of cases) {
    const rendered = formatAccelerator(accel);
    assert.ok(rendered.length > 0, `empty render for ${accel}`);
    assert.ok(!rendered.includes('+'), `separator leaked for ${accel}: ${rendered}`);
    assert.ok(!rendered.includes('Control'), `raw modifier leaked for ${accel}: ${rendered}`);
  }
});
