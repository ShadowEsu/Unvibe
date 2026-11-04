import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ActionBar, MenuList, TabStrip, loadingStep, menuKey, moreMenuItems, type MenuItem } from '../src/renderer/widget/sideWindow';
import { AnswerWait, waitingStatus } from '../src/renderer/shared/shortAnswer';

const noop = () => {};

function more(features = { whyExists: true, teachBack: true }): MenuItem[] {
  return moreMenuItems({
    features,
    answerReady: true,
    teachOpen: false,
    panelTheme: 'light',
    on: { explainDifferently: noop, why: noop, teach: noop, newTab: noop, saved: noop, theme: noop },
  });
}

function bar(props: Partial<Parameters<typeof ActionBar>[0]> = {}): string {
  return renderToStaticMarkup(createElement(ActionBar, {
    answerReady: true,
    understood: false,
    streaming: false,
    celebration: null,
    reduced: false,
    moreItems: more(),
    onGotIt: noop,
    onTestMe: noop,
    onStop: noop,
    onCelebrationEnd: noop,
    ...props,
  }));
}

const buttons = (html: string) => html.match(/<button[^>]*>/g) ?? [];

test('the action bar has exactly one filled primary, before and after Got it', () => {
  for (const html of [bar(), bar({ understood: true }), bar({ streaming: true, answerReady: false })]) {
    assert.equal(buttons(html).filter((b) => /sw-btn--primary/.test(b)).length, 1);
    assert.equal(buttons(html).filter((b) => /sw-btn--secondary/.test(b)).length, 1, 'Test me is the one outline secondary');
  }
});

test('Explain differently, Why and Teach live only in More, never as buttons in the bar', () => {
  const items = more();
  const html = bar({ moreItems: items });
  for (const id of ['different', 'why', 'teach']) {
    const item = items.find((i) => i.id === id);
    assert.ok(item, `More holds ${id}`);
    assert.ok(!html.includes(item.label), `${item.label} is not repeated in the bar`);
  }
  assert.ok(items.some((i) => i.id === 'newTab'), 'a new tab comes from More');
  assert.match(html, /aria-haspopup="menu"/);
});

test('More drops Why and Teach when those features are off, and waits for a finished answer', () => {
  assert.deepEqual(more({ whyExists: false, teachBack: false }).map((i) => i.id).filter((id) => id === 'why' || id === 'teach'), []);
  const waiting = moreMenuItems({
    features: { whyExists: true, teachBack: true }, answerReady: false, teachOpen: false, panelTheme: 'dark',
    on: { explainDifferently: noop, why: noop, teach: noop, newTab: noop, saved: noop, theme: noop },
  });
  for (const item of waiting) assert.equal(item.disabled === true, ['different', 'why', 'teach'].includes(item.id), item.id);
});

test('in an open menu Esc closes it, Tab closes it, and the arrows wrap', () => {
  assert.deepEqual(menuKey('Escape', 2, 5), { close: 'escape' });
  assert.deepEqual(menuKey('Tab', 0, 5), { close: 'tab' });
  assert.deepEqual(menuKey('ArrowDown', 4, 5), { focus: 0 });
  assert.deepEqual(menuKey('ArrowUp', 0, 5), { focus: 4 });
  assert.deepEqual(menuKey('ArrowUp', -1, 5), { focus: 4 }, 'from the trigger, up lands on the last item');
  assert.deepEqual(menuKey('Home', 3, 5), { focus: 0 });
  assert.deepEqual(menuKey('End', 0, 5), { focus: 4 });
  assert.equal(menuKey('a', 0, 5), null);
});

test('an open menu is a role=menu of menu items; radio items say which one is on', () => {
  const html = renderToStaticMarkup(createElement(MenuList, {
    id: 'm', label: 'Explanation level', placement: 'down-end', onPick: noop,
    items: [
      { id: 'beginner', label: 'Beginner', checked: true, onSelect: noop },
      { id: 'expert', label: 'Expert', checked: false, disabled: true, tag: 'Pro', onSelect: noop },
    ],
  }));
  assert.match(html, /role="menu"/);
  assert.equal((html.match(/role="menuitemradio"/g) ?? []).length, 2);
  assert.match(html, /aria-checked="true"[^>]*><span>Beginner/);
  assert.match(html, /aria-disabled="true"[^>]*><span>Expert/);
  const plain = renderToStaticMarkup(createElement(MenuList, { id: 'n', label: 'More actions', placement: 'up', onPick: noop, items: more() }));
  assert.equal((plain.match(/role="menuitem"/g) ?? []).length, more().length);
  assert.doesNotMatch(plain, /aria-checked/);
});

test('the tab strip is absent with one tab and present with two', () => {
  const tab = (id: string) => ({ id, label: `Review ${id}` });
  assert.equal(renderToStaticMarkup(createElement(TabStrip, { tabs: [tab('1')], activeId: '1', onSelect: noop, onClose: noop })), '');
  const two = renderToStaticMarkup(createElement(TabStrip, { tabs: [tab('1'), tab('2')], activeId: '2', onSelect: noop, onClose: noop }));
  assert.equal((two.match(/class="tab__label"/g) ?? []).length, 2);
  assert.match(two, /aria-pressed="true"[^>]*>Review 2/);
});

test('the loading step follows real events: captured, request sent, then gone at the first words', () => {
  const meta = { lines: 24, language: 'typescript' };
  const captured = loadingStep({ phase: 'ready', answerShown: false, ...meta });
  assert.equal(captured, waitingStatus(24, 'typescript'), 'captured: what is being read');
  const sent = loadingStep({ phase: 'streaming', answerShown: false, ...meta });
  assert.ok(sent && sent !== captured, 'the request went out: a different step');
  assert.equal(loadingStep({ phase: 'streaming', answerShown: true, ...meta }), null, 'the first words replace it');
  for (const phase of ['done', 'stopped', 'error', 'empty']) assert.equal(loadingStep({ phase, answerShown: false, ...meta }), null, phase);
});

test('the wait shows its skeleton only once it is due, and names itself once for screen readers', () => {
  const early = renderToStaticMarkup(createElement(AnswerWait, { status: 'Asking Vibe…' }));
  assert.doesNotMatch(early, /answer-skeleton/);
  assert.equal(early.split('Loading explanation').length - 1, 1);
  assert.match(renderToStaticMarkup(createElement(AnswerWait, { status: 'Asking Vibe…', skeleton: true })), /answer-skeleton/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(AnswerWait, { status: 'x', leaving: true })), /Loading explanation/, 'the fading copy is not announced again');
});
