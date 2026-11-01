import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { PanelHeader } from '../src/renderer/widget/panelHeader';
import { focusQuietly, QUIET_FOCUS } from '../src/renderer/widget/panelModel';

const noop = () => {};

function header(collapsed = false): string {
  return renderToStaticMarkup(createElement(PanelHeader, {
    mood: 'idle',
    source: null,
    status: { label: 'Ready', tone: 'done' },
    usage: { remaining: 29, resetsAt: '2026-11-28T12:00:00.000Z' },
    collapsed,
    onToggleCollapse: noop,
    onClose: noop,
  }));
}

test('the panel header has the status, the count, collapse and close, and no other control to take first focus', () => {
  for (const collapsed of [false, true]) {
    const html = header(collapsed);
    const buttons = [...html.matchAll(/<button\b[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]!);
    assert.equal((html.match(/<button\b/g) ?? []).length, 2, `two buttons, got: ${buttons.join(', ')}`);
    assert.match(buttons[0]!, collapsed ? /expand/i : /collapse/i);
    assert.match(buttons[1]!, /close/i);
    assert.match(html, /role="status"[^>]*>.*Ready</, 'the status is announced');
    assert.match(html, /class="head__usage"[^>]*>29\b/, 'the count stays');
    assert.equal((html.match(/<(input|select|textarea|a)\b/g) ?? []).length, 0);
  }
});

/** Enough of an element for focusQuietly: attributes, listeners, focus. */
function fakeElement() {
  const attrs = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  const focusCalls: FocusOptions[] = [];
  return {
    attrs, focusCalls,
    focus: (options?: FocusOptions) => { focusCalls.push(options ?? {}); },
    setAttribute: (name: string) => { attrs.add(name); },
    removeAttribute: (name: string) => { attrs.delete(name); },
    addEventListener: (type: string, fn: () => void) => { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn); },
    removeEventListener: (type: string, fn: () => void) => { listeners.get(type)?.delete(fn); },
    fire: (type: string) => { for (const fn of [...(listeners.get(type) ?? [])]) fn(); },
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
  };
}

test('first focus on the explanation has no ring until a key is pressed on it or focus leaves (R4)', () => {
  const el = fakeElement();
  focusQuietly(el as unknown as HTMLElement);
  assert.equal(el.focusCalls.length, 1);
  assert.equal(el.focusCalls[0]!.preventScroll, true, 'no scroll jump');
  assert.ok(el.attrs.has(QUIET_FOCUS), 'quiet: the ring is hidden');
  el.fire('keydown');
  assert.ok(!el.attrs.has(QUIET_FOCUS), 'a key on it: keyboard use, the ring shows');
  assert.equal(el.listenerCount(), 0, 'nothing left listening');

  focusQuietly(el as unknown as HTMLElement);
  assert.ok(el.attrs.has(QUIET_FOCUS));
  el.fire('blur');
  assert.ok(!el.attrs.has(QUIET_FOCUS), 'focus left: Tab back to it shows the ring');
  assert.equal(el.listenerCount(), 0);

  focusQuietly(null);
  assert.equal(el.focusCalls.length, 2, 'no explanation yet: nothing is focused');
});
