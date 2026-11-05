import assert from 'node:assert/strict';
import test from 'node:test';
import { captureConfirmReason, readLinuxPrimary } from '../src/main/selection';

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

test('a Linux shortcut capture waits for Explain, because PRIMARY may hold an old highlight', () => {
  assert.equal(captureConfirmReason({}, true), 'highlight');
  assert.equal(captureConfirmReason({}, false), null);
  // Explicit choices send at once on Linux too.
  assert.equal(captureConfirmReason({ preferClipboard: true }, true), null);
  assert.equal(captureConfirmReason({ sample: true }, true), null);
  assert.equal(captureConfirmReason({ captured: { code: 'x', sourceApp: 'Code' } }, true), null);
  // An unvibe://review link always waits, on every platform.
  assert.equal(captureConfirmReason({ confirm: true }, false), 'link');
  assert.equal(captureConfirmReason({ confirm: true }, true), 'link');
});
