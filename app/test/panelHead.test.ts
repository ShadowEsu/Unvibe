import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MenuList, TabStrip, menuKey, openFocus, panelMenuItems } from '../src/renderer/widget/panelMenu';

const noop = () => undefined;
const act = { explain: noop, depth: noop, testMe: noop, ask: noop, why: noop, teach: noop, newTab: noop, saved: noop, theme: noop, collapse: noop };
const state = (over: Partial<Parameters<typeof panelMenuItems>[0]> = {}) => ({
  status: 'Ready to learn', answerReady: true, features: { whyExists: true, teachBack: true }, teachOpen: false,
  dark: false, usage: { remaining: 29, resetsOn: 'December 1' }, ...over,
});
const ids = (items: ReturnType<typeof panelMenuItems>) => items.map((item) => item.id);

test('every tool the rail had is reachable from ⋯, with the status and what is left', () => {
  assert.deepEqual(ids(panelMenuItems(state(), act)), ['status', 'explain', 'depth', 'test', 'ask', 'why', 'teach', 'tab', 'saved', 'theme', 'collapse', 'left']);
  const items = panelMenuItems(state({ dark: true }), act);
  assert.equal(items.find((i) => i.id === 'theme')?.label, 'Light panel');
  assert.equal(items.find((i) => i.id === 'left')?.label, '29 left');
});

test('⋯ drops Why and Teach when those features are off, and its answer tools wait for a finished answer', () => {
  assert.deepEqual(ids(panelMenuItems(state({ features: {} }), act)).filter((id) => id === 'why' || id === 'teach'), []);
  const waiting = panelMenuItems(state({ answerReady: false }), act);
  for (const item of waiting) assert.equal(item.disabled === true, ['test', 'why', 'teach'].includes(item.id), item.id);
  assert.equal(ids(panelMenuItems(state({ usage: undefined }), act)).includes('left'), false, 'no "N left" before usage is known');
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

test('opening ⋯ focuses the first thing that does something (the last with ArrowUp), never the status line', () => {
  const items = panelMenuItems(state({ teachOpen: true }), act);
  assert.equal(items[openFocus(items)].id, 'explain');
  assert.equal(items[openFocus(items, 'last')].id, 'collapse', '"N left" is a line, not an action');
  const levels = ['new', 'beginner', 'expert'].map((id) => ({ id, label: id, checked: id === 'beginner', onSelect: noop }));
  assert.equal(levels[openFocus(levels)].id, 'beginner', 'a choice menu opens on the chosen one');
});

test('an open ⋯ is a role=menu of menu items; Teach says whether it is open; info rows do nothing', () => {
  const html = renderToStaticMarkup(createElement(MenuList, { id: 'm', label: 'Panel', onPick: noop, items: panelMenuItems(state({ teachOpen: true }), act) }));
  assert.match(html, /^<div class="pm-menu" id="m" role="menu" aria-label="Panel">/);
  assert.equal((html.match(/role="menuitem"/g) ?? []).length, 11);
  assert.match(html, /role="menuitemcheckbox" aria-checked="true"[^>]*><span>Teach it back/, 'Teach is a toggle, not a lone radio');
  assert.match(html, /aria-disabled="true"[^>]*class="pm-menu__item pm-menu__item--info"><span>Ready to learn/);
});

test('the tab strip is absent with one tab and present with two', () => {
  const tab = (id: string) => ({ id, label: `Review ${id}` });
  assert.equal(renderToStaticMarkup(createElement(TabStrip, { tabs: [tab('1')], activeId: '1', onSelect: noop, onClose: noop })), '');
  const two = renderToStaticMarkup(createElement(TabStrip, { tabs: [tab('1'), tab('2')], activeId: '2', onSelect: noop, onClose: noop }));
  assert.equal((two.match(/class="tab__label"/g) ?? []).length, 2);
  assert.match(two, /aria-pressed="true"[^>]*>Review 2/);
});
