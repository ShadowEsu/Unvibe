import assert from 'node:assert/strict';
import test from 'node:test';
import { readLinuxPrimary } from '../src/main/selection';

test('Linux capture explains the highlighted PRIMARY text, never the clipboard', () => {
  const asked: string[] = [];
  const result = readLinuxPrimary((type) => {
    asked.push(type);
    return 'const x = debounce(fn, 300);';
  });
  assert.deepEqual(result, { code: 'const x = debounce(fn, 300);' });
  assert.deepEqual(asked, ['selection']);
});

test('Linux capture with nothing highlighted reports empty instead of a stale clipboard', () => {
  assert.deepEqual(readLinuxPrimary(() => ''), { code: null, error: 'empty' });
  assert.deepEqual(readLinuxPrimary(() => '  \n\t'), { code: null, error: 'empty' });
});
