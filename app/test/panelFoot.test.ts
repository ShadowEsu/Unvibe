import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CodeRow, ExplainChips, StopButton } from '../src/renderer/widget/panelBody';

const noop = () => undefined;
const chips = (over: Partial<Parameters<typeof ExplainChips>[0]> = {}) => ({
  busy: false, understood: false, pinned: false, onUnderstand: noop, onSave: noop, onDifferent: noop, ...over,
});
// A button's visible label (icons are hidden SVGs).
const label = (inner: string) => inner.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '');
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => label(m[1]));
const buttonTag = (html: string, text: string) => [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].find((m) => label(m[2]) === text)?.[1] ?? '';

test('while the answer streams the footer offers only Stop generating', () => {
  assert.deepEqual(buttons(renderToStaticMarkup(createElement(StopButton, { onStop: noop }))), ['Stop generating']);
});

test('a finished answer offers three 28 px pills: Understand (the one filled), Save, Explain differently', () => {
  const html = renderToStaticMarkup(createElement(ExplainChips, chips()));
  assert.deepEqual(buttons(html), ['Understand', 'Save', 'Explain differently']);
  assert.equal((html.match(/class="ob-btn ob-btn--small"/g) ?? []).length, 1, 'one filled button: Understand');
  assert.equal((html.match(/class="ob-chip"/g) ?? []).length, 2, 'Save and Explain differently outlined');
  assert.ok(!html.includes('✓'), 'JetBrains Mono has no ✓: the check is an icon');
  assert.match(renderToStaticMarkup(createElement(ExplainChips, chips({ understood: true }))), /<svg class="ob-icon"[^>]*aria-hidden="true"/);
});

test('while the answer is still being revealed, all three wait', () => {
  const html = renderToStaticMarkup(createElement(ExplainChips, chips({ busy: true })));
  for (const text of ['Understand', 'Save', 'Explain differently']) assert.match(buttonTag(html, text), /\sdisabled=""/, text);
});

test('after Understand the chip stays pressed, and a second press does nothing new; Save shows whether it is pinned', () => {
  const html = renderToStaticMarkup(createElement(ExplainChips, chips({ understood: true, pinned: true })));
  assert.match(buttonTag(html, 'Understand'), /aria-pressed="true"/);
  assert.match(buttonTag(html, 'Save'), /aria-pressed="true"/);
  let presses = 0;
  const press = (understood: boolean) => {
    const tree = ExplainChips(chips({ understood, onUnderstand: () => { presses += 1; } })) as ReactElement<{ children: ReactElement<{ onClick?: () => void }>[] }>;
    tree.props.children[0]!.props.onClick!();
  };
  press(false);
  press(true);
  assert.equal(presses, 1);
});

test('the code row shows the first line and "Show code", with the whole selection still in the page', () => {
  const code = ['', 'function debounce(fn, wait) {', '  let timer;', '  return (...args) => {', '    timer = setTimeout(() => fn(...args), wait);', '  };', '}'].join('\n');
  const folded = renderToStaticMarkup(createElement(CodeRow, { id: 'c1', code, open: false, onToggle: noop }));
  assert.match(folded, /<span class="ob-code__line">function debounce\(fn, wait\) \{<\/span>/);
  const toggle = buttonTag(folded, 'Show code');
  assert.match(toggle, /aria-expanded="false"/);
  assert.match(toggle, /aria-controls="c1"/);
  assert.ok(folded.includes('timer = setTimeout(() =&gt; fn(...args), wait);'), 'the folded lines are in the DOM');
  const open = renderToStaticMarkup(createElement(CodeRow, { id: 'c1', code, open: true, onToggle: noop }));
  assert.match(open, /class="ob-code is-open"/);
  assert.match(buttonTag(open, 'Show less'), /aria-expanded="true"/);
});
