import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { AskField, CodeRow, ExplainActions, prefillAsk, QUESTION_CHIPS, QuestionChips, StopButton } from '../src/renderer/widget/panelBody';

const noop = () => undefined;
const chips = (over: Partial<Parameters<typeof ExplainActions>[0]> = {}) => ({
  busy: false, understood: false, pinned: false, onUnderstand: noop, onSave: noop, onDifferent: noop, ...over,
});
// A button's visible label (icons are hidden SVGs).
const label = (inner: string) => inner.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '');
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => label(m[1]));
const buttonTag = (html: string, text: string) => [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].find((m) => label(m[2]) === text)?.[1] ?? '';

test('while the answer streams the footer offers only Stop generating', () => {
  assert.deepEqual(buttons(renderToStaticMarkup(createElement(StopButton, { onStop: noop }))), ['Stop generating']);
});

test('"Question it" offers the three questions; the one whose text is in the box is pressed; none is filled', () => {
  const html = renderToStaticMarkup(createElement(QuestionChips, { busy: false, ask: 'What breaks if I remove it?', onQuestion: noop }));
  assert.deepEqual(buttons(html), ['Why this way?', 'What breaks if I remove it?', 'What would a reviewer flag?']);
  assert.match(html, /<span class="ob-questions__label" id="ob-questions-label">Question it<\/span>/);
  assert.deepEqual(QUESTION_CHIPS.map((q) => /aria-pressed="true"/.test(buttonTag(html, q))), [false, true, false]);
  assert.ok(!html.includes('ob-btn'), 'the Ask send stays the one filled control');
  const edited = renderToStaticMarkup(createElement(QuestionChips, { busy: false, ask: 'What breaks if I remove it? and why', onQuestion: noop }));
  assert.ok(!edited.includes('aria-pressed="true"'), 'edited text lets the chip go');
});

test('a question goes in an empty box or over another untouched question; typed text is never overwritten', () => {
  assert.equal(prefillAsk('', 'Why this way?'), 'Why this way?');
  assert.equal(prefillAsk('   ', 'Why this way?'), 'Why this way?');
  assert.equal(prefillAsk('Why this way?', 'What would a reviewer flag?'), 'What would a reviewer flag?');
  assert.equal(prefillAsk('Why this way? really', 'What would a reviewer flag?'), 'Why this way? really');
  assert.equal(prefillAsk('is this thread-safe', 'Why this way?'), 'is this thread-safe');
});

test('a chip never sends: it only hands its question over, and a held Enter that follows it into the box sends nothing', () => {
  const handed: string[] = [];
  let sent = 0;
  const chipsTree = QuestionChips({ busy: false, ask: '', onQuestion: (q) => handed.push(q) }) as ReactElement<{ children: [ReactElement, ReactElement<{ onClick: () => void }>[]] }>;
  for (const chip of chipsTree.props.children[1]) chip.props.onClick();
  assert.deepEqual(handed, [...QUESTION_CHIPS]);
  // The box now holds the question; the key handler is the real one.
  const box = AskField({ value: 'Why this way?', disabled: false, onChange: noop, onSend: () => { sent += 1; } }) as ReactElement<{ children: ReactElement<{ onKeyDown?: (e: unknown) => void }>[] }>;
  const keyDown = box.props.children.find((c) => c?.props?.onKeyDown)!.props.onKeyDown!;
  const enter = (repeat: boolean, isComposing: boolean) => keyDown({ key: 'Enter', repeat, nativeEvent: { isComposing } });
  enter(true, false);
  enter(false, true);
  assert.equal(sent, 0, 'a held Enter (repeat) or an input-method Enter does not send');
  enter(false, false);
  assert.equal(sent, 1, 'a fresh Enter is the person sending it');
});

test('after the box: Explain differently, Save, Understood as text buttons, none of them filled', () => {
  const html = renderToStaticMarkup(createElement(ExplainActions, chips()));
  assert.deepEqual(buttons(html), ['Explain differently', 'Save', 'Understood']);
  assert.match(html, /^<div class="ob-chips ob-chips--text">/);
  assert.ok(!html.includes('ob-btn'), 'at 320 px the Ask send is the panel\'s one filled control');
  assert.ok(!html.includes('✓'), 'JetBrains Mono has no ✓: the check is an icon');
  assert.match(renderToStaticMarkup(createElement(ExplainActions, chips({ understood: true }))), /<svg class="ob-icon"[^>]*aria-hidden="true"/);
});

test('while the answer is still being revealed, every action waits', () => {
  const html = renderToStaticMarkup(createElement(ExplainActions, chips({ busy: true })));
  for (const text of ['Understood', 'Save', 'Explain differently']) assert.match(buttonTag(html, text), /\sdisabled=""/, text);
  const questions = renderToStaticMarkup(createElement(QuestionChips, { busy: true, ask: '', onQuestion: noop }));
  for (const q of QUESTION_CHIPS) assert.match(buttonTag(questions, q), /\sdisabled=""/, q);
});

test('after Understood the button stays pressed, and a second press does nothing new; Save shows whether it is pinned', () => {
  const html = renderToStaticMarkup(createElement(ExplainActions, chips({ understood: true, pinned: true })));
  assert.match(buttonTag(html, 'Understood'), /aria-pressed="true"/);
  assert.match(buttonTag(html, 'Save'), /aria-pressed="true"/);
  let presses = 0;
  const press = (understood: boolean) => {
    const tree = ExplainActions(chips({ understood, onUnderstand: () => { presses += 1; } })) as ReactElement<{ children: ReactElement<{ onClick?: () => void }>[] }>;
    tree.props.children[2]!.props.onClick!();
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
