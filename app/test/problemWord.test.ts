import test from 'node:test';
import assert from 'node:assert/strict';
import { problemWord } from '../src/renderer/bar/problemWord';

test('an error pulse shows its own word for a limit, an empty selection or a blocked send, and "Issue" for anything else', () => {
  assert.equal(problemWord('error', 'Limit'), 'Limit');
  assert.equal(problemWord('error', 'Select code'), 'Select code');
  assert.equal(problemWord('error', 'Blocked'), 'Blocked');
  assert.equal(problemWord('error', 'Issue'), 'Issue');
  // A label that isn't one of the Island's words (or none) falls back, so main can't put arbitrary text there.
  assert.equal(problemWord('error', 'Limit reached'), 'Issue');
  assert.equal(problemWord('error', 'Something went wrong while explaining your code'), 'Issue');
  assert.equal(problemWord('error', ''), 'Issue');
  assert.equal(problemWord('error', undefined), 'Issue');
  assert.equal(problemWord('offline', 'Limit'), 'Offline');
});
