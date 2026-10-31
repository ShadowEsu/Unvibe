import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { PanelHeader } from '../src/renderer/widget/panelHeader';

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
