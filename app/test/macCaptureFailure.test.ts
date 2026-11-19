import assert from 'node:assert/strict';
import test from 'node:test';
import { macCaptureFailure, nextCaptureBlock, parseWindowsForeground } from '../src/main/selection';

test('a Mac copy refused by Automation (-1743) is told apart, so the person learns which switch to turn on', () => {
  // execFile's error message carries osascript's stderr.
  const denied = Object.assign(
    new Error('Command failed: osascript -e tell application "System Events" to key code 8 using {command down}\n'
      + '29:58: execution error: Not authorized to send Apple events to System Events. (-1743)'),
    { code: 1, killed: false },
  );
  assert.equal(macCaptureFailure(denied), 'automation_denied');
});

test('a Mac copy that ran out of time (macOS still asking) is not reported as a refusal', () => {
  const timedOut = Object.assign(new Error('Command failed: osascript -e …'), { killed: true, signal: 'SIGTERM' });
  assert.equal(macCaptureFailure(timedOut), 'automation_timeout');
  // osascript's own AppleEvent timeout, seen on a runner while macOS's question was still up.
  const appleEventTimeout = Object.assign(
    new Error('Command failed: osascript\n84:116: execution error: System Events got an error: AppleEvent timed out. (-1712)'),
    { code: 1, killed: false },
  );
  assert.equal(macCaptureFailure(appleEventTimeout), 'automation_timeout');
});

test('only a shortcut press changes what the panel says about System Events', () => {
  const press = {};
  // A refused press is remembered, and the next press that copies something clears it.
  const denied = nextCaptureBlock(null, press, { code: null, error: 'automation_denied' });
  assert.equal(denied, 'automation_denied');
  assert.equal(nextCaptureBlock(denied, press, { code: 'const a = 1;' }), null);
  // A press that fails for another reason (nothing selected) is not a System Events problem any more.
  assert.equal(nextCaptureBlock(denied, press, { code: null, error: 'empty' }), null);
  assert.equal(nextCaptureBlock(null, press, { code: null, error: 'automation_timeout' }), 'automation_timeout');
  // The sample, an already captured selection and clipboard explains never touch System Events.
  for (const options of [{ sample: true }, { captured: { code: 'x', sourceApp: 'Code' } }, { preferClipboard: true }]) {
    assert.equal(nextCaptureBlock(denied, options, { code: null, error: 'empty' }), 'automation_denied');
    assert.equal(nextCaptureBlock(null, options, { code: 'x' }), null);
  }
});

test('other Mac copy failures, such as a missing Accessibility grant, stay plain failures', () => {
  const noAccessibility = Object.assign(
    new Error('Command failed: osascript\nexecution error: System Events got an error: osascript is not allowed to send keystrokes. (1002)'),
    { code: 1, killed: false },
  );
  assert.equal(macCaptureFailure(noAccessibility), 'failed');
  assert.equal(macCaptureFailure(undefined), 'failed');
});

test('Windows: a foreground window that runs as administrator is told apart from an empty selection', () => {
  // PowerShell prints the process name, then the elevation flag; UIPI drops the copy keystroke on the way to an
  // elevated window and SendKeys still reports success, so the flag is the only signal.
  assert.deepEqual(parseWindowsForeground('powershell\r\n1\r\n'), { name: 'powershell', elevated: true });
  assert.deepEqual(parseWindowsForeground('Code\r\n0\r\n'), { name: 'Code', elevated: false });
  // No name (the process could not be queried at all) is still an elevated answer; an older print without the flag
  // is a plain name.
  assert.deepEqual(parseWindowsForeground('\r\n1\r\n'), { name: null, elevated: true });
  assert.deepEqual(parseWindowsForeground('notepad\r\n'), { name: 'notepad', elevated: false });
  // The panel keeps the elevated note until the next press, like a System Events refusal; a press that copies clears it.
  const elevated = nextCaptureBlock(null, {}, { code: null, error: 'elevated' });
  assert.equal(elevated, 'elevated');
  assert.equal(nextCaptureBlock(elevated, { preferClipboard: true }, { code: null, error: 'empty' }), 'elevated');
  assert.equal(nextCaptureBlock(elevated, {}, { code: 'let x = 1;' }), null);
});
