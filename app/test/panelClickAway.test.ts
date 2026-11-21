import test from 'node:test';
import assert from 'node:assert/strict';
import { FADE_IN_MS, FADE_OPACITY, FADE_OUT_MS, NOT_FADED, fadeStyle, isFaded, nextFade } from '../src/renderer/widget/clickAway';
import { panelThemeMigration } from '../src/renderer/widget/themeMigration';
import { appSwitchAction, clickAwayOnBlur } from '../src/main/windows';

test('Fade drops the pane to 22 % over 200 ms when focus leaves, and back to 100 % over 150 ms', () => {
  const away = nextFade(NOT_FADED, 'away');
  assert.deepEqual(fadeStyle(away, false), { opacity: FADE_OPACITY, transitionMs: FADE_OUT_MS });
  assert.equal(FADE_OPACITY, 0.22);
  assert.deepEqual(fadeStyle(nextFade(away, 'back'), false), { opacity: 1, transitionMs: FADE_IN_MS });
});

test('a press or a rested pointer brings a faded pane back; leaving it unfocused lets it fade again', () => {
  const away = nextFade(NOT_FADED, 'away');
  for (const wake of ['press', 'hoverWake'] as const) {
    const woken = nextFade(away, wake);
    assert.equal(fadeStyle(woken, false).opacity, 1, wake);
    assert.equal(fadeStyle(nextFade(woken, 'leave'), false).opacity, FADE_OPACITY, wake);
  }
  assert.deepEqual(nextFade(NOT_FADED, 'press'), NOT_FADED, 'a focused pane is never faded');
});

test('only the first press on a faded pane is swallowed: it wakes the pane, and the next press reaches its buttons (Security S5)', () => {
  const away = nextFade(NOT_FADED, 'away');
  assert.equal(isFaded(away), true, 'at 22 % the press only wakes it');
  assert.equal(isFaded(nextFade(away, 'press')), false, 'woken by that press: the next one works');
  assert.equal(isFaded(nextFade(away, 'hoverWake')), false, 'woken by a rested pointer: the press works');
  assert.equal(isFaded(nextFade(nextFade(away, 'press'), 'leave')), true, 'faded again after the pointer leaves');
  assert.equal(isFaded(NOT_FADED), false, 'a focused pane works as always');
});

test('with reduced motion the opacity changes at once', () => {
  assert.equal(fadeStyle(nextFade(NOT_FADED, 'away'), true).transitionMs, 0);
  assert.equal(fadeStyle(NOT_FADED, true).transitionMs, 0);
});

test('main fades or hides on blur as Settings says, and does neither while the limit pause or a dialog holds the panel', () => {
  assert.equal(clickAwayOnBlur('fade', false), 'fade');
  assert.equal(clickAwayOnBlur('hide', false), 'hide');
  assert.equal(clickAwayOnBlur('hide', true), 'stay');
  assert.equal(clickAwayOnBlur('fade', true), 'stay');
});

test('macOS app switches: another app coming to the front runs the click-away rule; Unvibe itself, or a note it cannot read, does nothing', () => {
  const own = 4321;
  const shown = { visible: true, focused: false };
  const note = (desc: unknown) => ({ kind: 'activated' as const, info: { NSWorkspaceApplicationKey: desc } });
  const vscode = note('<NSRunningApplication: 0x600002f1c000 (com.microsoft.VSCode - 812) LSASN:{hi=0x0;lo=0x1a01a}>');
  const unvibe = note('<NSRunningApplication: 0x600002f1c0a0 (com.unvibe.app - 4321) LSASN:{hi=0x0;lo=0x2b02b}>');
  assert.equal(appSwitchAction(vscode, own, shown, 'fade', false), 'fade');
  assert.equal(appSwitchAction(vscode, own, shown, 'hide', false), 'hide');
  assert.equal(appSwitchAction(unvibe, own, shown, 'hide', false), 'none');
  // A pid that only starts with Unvibe's is another app.
  assert.equal(appSwitchAction(note('<NSRunningApplication: 0x1 (com.microsoft.VSCode - 43210) LSASN:{}>'), own, shown, 'fade', false), 'fade');
  // Unreadable: with Hide, a misread of Unvibe's own activation would hide the panel just clicked (lead S1 on #378).
  for (const unreadable of [note(7), note('<NSRunningApplication: 0x1>'), { kind: 'activated' as const, info: {} }, { kind: 'activated' as const, info: { other: '(x - 812)' } }]) {
    assert.equal(appSwitchAction(unreadable, own, shown, 'hide', false), 'none');
  }
});

test('macOS app switches: Unvibe resigning fades or hides a shown panel, never while held, and coming back restores it only when it is key', () => {
  const own = 4321;
  const resigned = { kind: 'resigned' as const };
  const returned = { kind: 'returned' as const };
  assert.equal(appSwitchAction(resigned, own, { visible: true, focused: true }, 'fade', false), 'fade');
  assert.equal(appSwitchAction(resigned, own, { visible: true, focused: false }, 'hide', false), 'hide');
  assert.equal(appSwitchAction(resigned, own, { visible: true, focused: true }, 'hide', true), 'none', 'the limit pause or a dialog holds it');
  assert.equal(appSwitchAction(resigned, own, { visible: false, focused: false }, 'fade', false), 'none', 'a hidden panel is left alone');
  assert.equal(appSwitchAction(returned, own, { visible: true, focused: true }, 'fade', false), 'back');
  assert.equal(appSwitchAction(returned, own, { visible: true, focused: false }, 'fade', false), 'none', 'the companion came forward, not the panel');
  assert.equal(appSwitchAction(returned, own, { visible: false, focused: true }, 'fade', false), 'none');
});

test('a dark panel moon becomes Theme: Dark once, only when Theme was never chosen, and the old key goes', () => {
  assert.deepEqual(panelThemeMigration('dark', { theme: 'light' }), { setTheme: 'dark', dropKey: true });
  assert.deepEqual(panelThemeMigration('dark', {}), { setTheme: 'dark', dropKey: true });
  assert.deepEqual(panelThemeMigration('dark', { theme: 'light', themeChosen: true }), { setTheme: null, dropKey: true }, 'chose light on purpose');
  assert.deepEqual(panelThemeMigration('dark', { theme: 'system' }), { setTheme: null, dropKey: true });
  assert.deepEqual(panelThemeMigration('light', { theme: 'light' }), { setTheme: null, dropKey: true });
  assert.deepEqual(panelThemeMigration(null, { theme: 'light' }), { setTheme: null, dropKey: false });
});
