import test from 'node:test';
import assert from 'node:assert/strict';
import { languageName, selectionSource, selectionTitle } from '../src/renderer/shared/languageName';

test('the panel title names the language a reader knows, and says "code" for ids it does not', () => {
  assert.equal(selectionTitle(7, 'javascript'), '7 lines of JavaScript');
  assert.equal(selectionTitle(1, 'typescriptreact'), '1 line of TypeScript');
  assert.equal(selectionTitle(3, 'plaintext'), '3 lines of code');
  assert.equal(selectionTitle(3, 'brainfuck'), '3 lines of code');
  assert.equal(selectionTitle(3), '3 lines of code');
  assert.equal(languageName('csharp'), 'C#');
});

test('the source line shows the app and only the file name, never a path', () => {
  assert.equal(selectionSource('Cursor', '/Users/sam/app/src/debounce.js'), 'from Cursor · debounce.js');
  assert.equal(selectionSource('Notepad', 'C:\\work\\retry.ts'), 'from Notepad · retry.ts');
  assert.equal(selectionSource('Cursor'), 'from Cursor');
  assert.equal(selectionSource(null, 'src/a.py'), 'a.py');
  assert.equal(selectionSource(null, ''), undefined);
});
