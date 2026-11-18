import test from 'node:test';
import assert from 'node:assert/strict';
import { commandUHint, type HintInput } from '../src/main/commandUHint';

const key = (over: Partial<HintInput> = {}): HintInput => ({ type: 'keyDown', key: 'u', meta: false, control: false, alt: false, shift: false, ...over });
const mac = { platform: 'darwin' as NodeJS.Platform, sendingOff: false, shortcut: 'Control+U', recording: false };

test('⌘U on a Mac shows the hint', () => {
  assert.equal(commandUHint(key({ meta: true }), mac), true);
  assert.equal(commandUHint(key({ meta: true, key: 'U' }), mac), true);
});

test('Control+U, the real shortcut, shows nothing', () => {
  assert.equal(commandUHint(key({ control: true }), mac), false);
});

test('⌘⇧U, ⌘⌥U and ⌘⌃U show nothing', () => {
  assert.equal(commandUHint(key({ meta: true, shift: true }), mac), false);
  assert.equal(commandUHint(key({ meta: true, alt: true }), mac), false);
  assert.equal(commandUHint(key({ meta: true, control: true }), mac), false);
});

test('only the key press counts, and only U', () => {
  assert.equal(commandUHint(key({ meta: true, type: 'keyUp' }), mac), false);
  assert.equal(commandUHint(key({ meta: true, key: 'i' }), mac), false);
});

test('Windows and Linux show nothing', () => {
  assert.equal(commandUHint(key({ meta: true }), { ...mac, platform: 'win32', shortcut: 'Control+Alt+U' }), false);
  assert.equal(commandUHint(key({ meta: true }), { ...mac, platform: 'linux', shortcut: 'Control+Alt+U' }), false);
});

test('sending switched off shows nothing (Security A1)', () => {
  assert.equal(commandUHint(key({ meta: true }), { ...mac, sendingOff: true }), false);
});

test('a Command+U shortcut of their own shows nothing (Security A1)', () => {
  assert.equal(commandUHint(key({ meta: true }), { ...mac, shortcut: 'Command+U' }), false);
  assert.equal(commandUHint(key({ meta: true }), { ...mac, shortcut: 'CommandOrControl+U' }), false);
});

test('while Settings records a new shortcut, ⌘U is the person choosing it: no hint', () => {
  assert.equal(commandUHint(key({ meta: true }), { ...mac, recording: true }), false);
});
