import assert from 'node:assert/strict';
import test from 'node:test';
import { prettyShortcut } from '../src/renderer/shared/prettyShortcut';

test('prettyShortcut uses Ctrl on Windows and glyphs on Mac', () => {
  assert.equal(prettyShortcut('CommandOrControl+U', true), 'Ctrl+U');
  assert.equal(prettyShortcut('CommandOrControl+U', false), '⌘U');
});
