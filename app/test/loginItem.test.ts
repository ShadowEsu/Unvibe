import test from 'node:test';
import assert from 'node:assert/strict';
import { isLoginLaunch, launchOpensWindow, LOGIN_LAUNCH_ARG, loginItemFallback, loginPromptStep } from '../src/core/loginItem';

const off = () => false;
const on = () => true;

test('the launch-at-login question is asked once, on the first explanation of own code', () => {
  assert.equal(loginPromptStep({ ownCode: false, asked: false, launchAtLogin: off }), 'none', 'the first-run sample does not ask');
  assert.equal(loginPromptStep({ ownCode: true, asked: false, launchAtLogin: off }), 'ask');
  // Yes or No, the question was asked: later explanations never bring it back, even with launch at login off.
  assert.equal(loginPromptStep({ ownCode: true, asked: true, launchAtLogin: off }), 'none');
});

test('launch at login already on settles the question without asking', () => {
  assert.equal(loginPromptStep({ ownCode: true, asked: false, launchAtLogin: on }), 'settle');
  // Once settled, turning it off later in Settings does not bring the question back.
  assert.equal(loginPromptStep({ ownCode: true, asked: true, launchAtLogin: off }), 'none');
});

test('a login launch starts with no window, so it is not a return', () => {
  const winLogin = isLoginLaunch('win32', ['C:\\Unvibe\\Unvibe.exe', LOGIN_LAUNCH_ARG], false);
  const macLogin = isLoginLaunch('darwin', ['/Applications/Unvibe.app/Contents/MacOS/Unvibe'], true);
  assert.equal(winLogin, true);
  assert.equal(macLogin, true);
  assert.equal(launchOpensWindow(winLogin, true), false);
  assert.equal(launchOpensWindow(macLogin, true), false);
  // Before setup is finished the companion still opens so the user can finish it.
  assert.equal(launchOpensWindow(winLogin, false), true);
});

test('a launch the user started opens the companion', () => {
  const winClick = isLoginLaunch('win32', ['C:\\Unvibe\\Unvibe.exe'], false);
  const macClick = isLoginLaunch('darwin', ['/Applications/Unvibe.app/Contents/MacOS/Unvibe'], false);
  assert.equal(winClick, false);
  assert.equal(macClick, false);
  assert.equal(launchOpensWindow(macClick, true), true);
});

test('the user is told where to turn it on only when the OS did not take the login item', () => {
  assert.equal(loginItemFallback('darwin', { openAtLogin: true, status: 'enabled' }), null);
  assert.notEqual(loginItemFallback('darwin', { openAtLogin: true, status: 'requires-approval' }), null);
  assert.notEqual(loginItemFallback('darwin', { openAtLogin: false, status: 'not-registered' }), null);
  assert.equal(loginItemFallback('win32', { openAtLogin: true }), null);
  assert.notEqual(loginItemFallback('win32', { openAtLogin: false }), null);
});
