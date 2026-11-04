import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Celebration, CountUp, claimCelebration, countUpValue, type DayStore } from '../src/renderer/shared/motion';
import { countUpMs } from '../src/renderer/shared/motionTokens';
import { ActionBar } from '../src/renderer/widget/sideWindow';

function memoryStore(seed: Record<string, string> = {}): DayStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}

const noop = () => {};

test('a celebration plays at most once per trigger per day', () => {
  const store = memoryStore();
  const on = (trigger: 'gotIt' | 'testCorrect', today: string) => claimCelebration(trigger, { enabled: true, today, store });
  assert.equal(on('gotIt', '2026-11-04'), true);
  assert.equal(on('gotIt', '2026-11-04'), false, 'the second Got it that day is quiet');
  assert.equal(on('testCorrect', '2026-11-04'), true, 'each trigger has its own day');
  assert.equal(on('gotIt', '2026-11-05'), true, 'the next day it may play again');
});

test('a celebration never plays while the Celebrations setting is off, and off does not use up the day', () => {
  const store = memoryStore();
  assert.equal(claimCelebration('gotIt', { enabled: false, today: '2026-11-04', store }), false);
  assert.equal(store.data.size, 0);
  assert.equal(claimCelebration('gotIt', { enabled: true, today: '2026-11-04', store }), true);
});

test('storage that fails means no celebration rather than one every time', () => {
  const broken: DayStore = { getItem: () => { throw new Error('blocked'); }, setItem: noop };
  assert.equal(claimCelebration('firstRun', { enabled: true, today: '2026-11-04', store: broken }), false);
});

test('reduced motion adds no animation classes: no burst and no pop, only the check and the colour', () => {
  const props = {
    answerReady: true, understood: true, streaming: false, celebration: 1, moreItems: [],
    onGotIt: noop, onTestMe: noop, onStop: noop, onCelebrationEnd: noop,
  };
  const moving = renderToStaticMarkup(createElement(ActionBar, { ...props, reduced: false }));
  assert.match(moving, /class="celebrate"/);
  assert.match(moving, /check-mark--pop/);
  const still = renderToStaticMarkup(createElement(ActionBar, { ...props, reduced: true }));
  assert.doesNotMatch(still, /class="celebrate"|celebrate__shape/);
  assert.doesNotMatch(still, /--pop/);
  assert.match(still, /class="check-mark"/, 'the static check stays');
  assert.match(still, /sw-btn--understood/, 'and so does the colour change');
});

test('the burst is 8 shapes and only renders while a celebration runs', () => {
  const burst = renderToStaticMarkup(createElement(Celebration, { run: 7, reduced: false, onEnd: noop }));
  assert.equal((burst.match(/celebrate__shape/g) ?? []).length, 8);
  assert.equal(renderToStaticMarkup(createElement(Celebration, { run: null, reduced: false, onEnd: noop })), '');
});

test('a count-up eases from the previous value to the final one in the spec length', () => {
  assert.equal(countUpMs(12), 700);
  assert.equal(countUpValue(12, 20, 0), 12);
  assert.equal(countUpValue(12, 20, countUpMs(20)), 20);
  let last = 12;
  for (let t = 0; t <= countUpMs(20); t += 35) {
    const value = countUpValue(12, 20, t);
    assert.ok(value >= last && value <= 20, `never backwards or past the end at ${t} ms`);
    last = value;
  }
  assert.ok(countUpValue(0, 100, countUpMs(100) / 2) > 50, 'ease-out: more than half way at half time');
});

test('a count-up tells screen readers only the final number while its digits start from the last one shown', () => {
  const store = memoryStore({ 'unvibe.weekCountShown': '12' });
  Object.assign(globalThis, {
    window: {
      localStorage: store,
      matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    },
  });
  try {
    const label = (n: number) => `${n} explained this week`;
    const html = renderToStaticMarkup(createElement(CountUp, { value: 13, label, storageKey: 'unvibe.weekCountShown', reduced: false }));
    assert.match(html, /role="img" aria-label="13 explained this week"/);
    assert.match(html, /<span aria-hidden="true">.*>12<\/b>/, 'the moving digits start at the last value and are hidden');
    const still = renderToStaticMarkup(createElement(CountUp, { value: 13, label, storageKey: 'unvibe.weekCountShown', reduced: true }));
    assert.match(still, />13<\/b>/, 'reduced motion shows the final value at once');
  } finally {
    Reflect.deleteProperty(globalThis, 'window');
  }
});
