import test from 'node:test';
import assert from 'node:assert/strict';
import { FADE_IN_MS, FADE_OPACITY, FADE_OUT_MS, NOT_FADED, fadeStyle, nextFade } from '../src/renderer/widget/clickAway';
import { panelThemeMigration } from '../src/renderer/widget/themeMigration';
import { clickAwayOnBlur } from '../src/main/windows';

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

test('a dark panel moon becomes Theme: Dark once, only when Theme was never chosen, and the old key goes', () => {
  assert.deepEqual(panelThemeMigration('dark', { theme: 'light' }), { setTheme: 'dark', dropKey: true });
  assert.deepEqual(panelThemeMigration('dark', {}), { setTheme: 'dark', dropKey: true });
  assert.deepEqual(panelThemeMigration('dark', { theme: 'light', themeChosen: true }), { setTheme: null, dropKey: true }, 'chose light on purpose');
  assert.deepEqual(panelThemeMigration('dark', { theme: 'system' }), { setTheme: null, dropKey: true });
  assert.deepEqual(panelThemeMigration('light', { theme: 'light' }), { setTheme: null, dropKey: true });
  assert.deepEqual(panelThemeMigration(null, { theme: 'light' }), { setTheme: null, dropKey: false });
});
