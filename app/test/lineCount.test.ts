import test from 'node:test';
import assert from 'node:assert/strict';
import { lineCount } from '../src/core/lineCount';

test('a selection that ends with a newline (a terminal or whole-line copy) is not one line longer', () => {
  assert.equal(lineCount('a\nb\n'), 2);
  assert.equal(lineCount('a\r\nb\r\n'), 2);
  // Only the last newline is forgiven: a blank line before it still counts.
  assert.equal(lineCount('a\n\n'), 2);
  assert.equal(lineCount(''), 1);
  assert.equal(lineCount('a\nb'), 2);
});
