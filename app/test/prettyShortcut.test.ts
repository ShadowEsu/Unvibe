import assert from 'node:assert/strict';
import test from 'node:test';
import { prettyShortcut, shortcutCaps } from '../src/renderer/shared/prettyShortcut';

test('prettyShortcut uses Ctrl on Windows and Linux, glyphs on Mac', () => {
  assert.equal(prettyShortcut('CommandOrControl+U', true), 'Ctrl+U');
  assert.equal(prettyShortcut('CommandOrControl+U', false), '⌘U');
});

test('shortcutCaps gives one cap per key, in the same words and glyphs', () => {
  assert.deepEqual(shortcutCaps('Control+Alt+U', true), ['Ctrl', 'Alt', 'U']);
  assert.deepEqual(shortcutCaps('Control+U', false), ['⌃', 'U']);
  assert.deepEqual(shortcutCaps('CommandOrControl+Shift+Space', false), ['⌘', '⇧', 'Space']);
  assert.deepEqual(shortcutCaps('CommandOrControl+Shift+Space', true), ['Ctrl', 'Shift', 'Space']);
});
