import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CodeBlock, PanelActions, codeLineCount } from '../src/renderer/widget/panelBody';

const noop = () => undefined;
const actions = (over: Partial<Parameters<typeof PanelActions>[0]> = {}) => ({
  streaming: false, busy: false, understood: false, onStop: noop, onGotIt: noop, onDifferent: noop, onTestMe: noop, ...over,
});
// A button's visible label (the primary key wraps it in a face span).
const label = (inner: string) => inner.replace(/<[^>]+>/g, '');
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => label(m[1]));

test('while the answer streams the footer offers only Stop generating', () => {
  const html = renderToStaticMarkup(createElement(PanelActions, actions({ streaming: true })));
  assert.deepEqual(buttons(html), ['Stop generating']);
  assert.ok(!html.includes('btn-primary'));
});

const buttonTag = (html: string, text: string) => [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].find((m) => label(m[2]) === text)?.[1] ?? '';

test('a finished answer has exactly one primary action, Got it, and the rest are quiet', () => {
  const html = renderToStaticMarkup(createElement(PanelActions, actions()));
  assert.deepEqual(buttons(html), ['Got it', 'Explain differently', 'Test me']);
  assert.equal((html.match(/class="btn-primary[" ]/g) ?? []).length, 1);
  assert.match(buttonTag(html, 'Got it'), /class="btn-primary"/);
  assert.equal((html.match(/class="btn-quiet"/g) ?? []).length, 2);
});

test('while the answer is still being revealed, all three wait', () => {
  const html = renderToStaticMarkup(createElement(PanelActions, actions({ busy: true })));
  for (const label of ['Got it', 'Explain differently', 'Test me']) assert.match(buttonTag(html, label), /\sdisabled=""/, label);
});

test('after Got it the button stays pressed and focusable, and a second press does nothing new', () => {
  const tag = buttonTag(renderToStaticMarkup(createElement(PanelActions, actions({ understood: true }))), 'Got it');
  assert.match(tag, /class="btn-primary btn-primary--pressed"/);
  assert.match(tag, /aria-disabled="true"/);
  assert.doesNotMatch(tag, /\sdisabled=""/, 'native disabled would drop focus from the button just pressed');
  let presses = 0;
  const press = (understood: boolean) => {
    const tree = PanelActions(actions({ understood, onGotIt: () => { presses += 1; } })) as ReactElement<{ children: ReactElement<{ onClick?: () => void; children?: unknown }>[] }>;
    tree.props.children.find((child) => child?.props?.children === 'Got it')!.props.onClick!();
  };
  press(false);
  press(true);
  assert.equal(presses, 1);
});

test('code longer than 3 lines folds behind "Show all N lines", with the whole selection still in the page', () => {
  const code = ['function debounce(fn, wait) {', '  let timer;', '  return (...args) => {', '    clearTimeout(timer);', '    timer = setTimeout(() => fn(...args), wait);', '  };', '}'].join('\n');
  const folded = renderToStaticMarkup(createElement(CodeBlock, { id: 'c1', code, language: 'JavaScript', open: false, onToggle: noop }));
  assert.match(folded, /class="code-context code-context--folded"/);
  const toggle = buttonTag(folded, 'Show all 7 lines');
  assert.match(toggle, /aria-expanded="false"/);
  assert.match(toggle, /aria-controls="c1"/);
  assert.match(folded, /<pre id="c1"/);
  assert.ok(folded.includes('timer = setTimeout(() =&gt; fn(...args), wait);'), 'the hidden lines are in the DOM');
  assert.match(folded, /<span class="code-context__lang">JavaScript<\/span>/);
  const open = renderToStaticMarkup(createElement(CodeBlock, { id: 'c1', code, language: 'JavaScript', open: true, onToggle: noop }));
  assert.ok(!open.includes('code-context--folded'));
  assert.match(buttonTag(open, 'Show less'), /aria-expanded="true"/);
});

test('code of unknown language shows no language label', () => {
  const html = renderToStaticMarkup(createElement(CodeBlock, { id: 'c3', code: 'a\nb\nc\nd', open: false, onToggle: noop }));
  assert.ok(!html.includes('code-context__lang'));
  assert.match(html, />Show all 4 lines</);
});

test('three lines or fewer show in full with no toggle; a trailing newline is not a line', () => {
  assert.equal(codeLineCount('a\nb\nc\n'), 3);
  const html = renderToStaticMarkup(createElement(CodeBlock, { id: 'c2', code: 'a\nb\nc\n', language: 'python', open: false, onToggle: noop }));
  assert.ok(!html.includes('<button'));
  assert.ok(!html.includes('code-context--folded'));
  assert.match(html, /code-context__lang">python</);
});
