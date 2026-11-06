import assert from 'node:assert/strict';
import test from 'node:test';
import { macCaptureFailure } from '../src/main/selection';

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
});

test('other Mac copy failures, such as a missing Accessibility grant, stay plain failures', () => {
  const noAccessibility = Object.assign(
    new Error('Command failed: osascript\nexecution error: System Events got an error: osascript is not allowed to send keystrokes. (1002)'),
    { code: 1, killed: false },
  );
  assert.equal(macCaptureFailure(noAccessibility), 'failed');
  assert.equal(macCaptureFailure(undefined), 'failed');
});
