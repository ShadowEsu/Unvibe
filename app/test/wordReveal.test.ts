import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, Fragment } from 'react';
import { renderRich } from '../src/renderer/shared/richText';
import { revealStep } from '../src/renderer/widget/reveal';
import { ShortAnswer } from '../src/renderer/shared/shortAnswer';

const html = (text: string, words: boolean, streaming = false) => renderToStaticMarkup(createElement(Fragment, null, ...renderRich(text, streaming, { words })));
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, '');

/** Runs the reveal as an answer streams in `chunk`-sized pieces, then finishes; returns every text shown. */
function stream(full: string, chunk: number): string[] {
  const shown: string[] = [];
  let buffer = '';
  let text = '';
  const frames = (streaming: boolean) => {
    for (;;) {
      const step = revealStep(text, buffer, streaming);
      if (step.text !== text) shown.push(step.text);
      text = step.text;
      if (!step.more) return;
    }
  };
  for (let i = 0; i < full.length; i += chunk) {
    buffer = full.slice(0, i + chunk);
    frames(true);
  }
  frames(false);
  return shown;
}

const ANSWER = 'The debounce waits `wait` ms after the **last call**, then runs fn once with the latest args.';

test('the reveal shows whole words only, never takes text back, and ends on the whole answer', () => {
  for (const chunk of [1, 3, 7, 16, 40]) {
    const shown = stream(ANSWER, chunk);
    assert.equal(shown.at(-1), ANSWER, `chunk ${chunk}`);
    shown.forEach((text, i) => {
      if (i > 0) assert.ok(text.startsWith(shown[i - 1]!) && text.length > shown[i - 1]!.length, `chunk ${chunk}: grows`);
      if (text !== ANSWER) assert.match(`${text.slice(-1)}${ANSWER.slice(text.length, text.length + 1)}`, /\s/, `chunk ${chunk}: "${text}" ends inside a word`);
    });
  }
});

test('while streaming, a last word with no space after it yet waits; once done it shows', () => {
  assert.deepEqual(revealStep('The ', 'The debounce wai', true), { text: 'The debounce', more: true });
  assert.deepEqual(revealStep('The debounce', 'The debounce wai', true), { text: 'The debounce ', more: false });
  assert.deepEqual(revealStep('The debounce ', 'The debounce wai', true), { text: 'The debounce ', more: false });
  assert.equal(revealStep('The debounce', 'The debounce wait', false).text, 'The debounce wait');
});

test('word wrapping keeps the text, its spaces, code spans and bold exactly as without it', () => {
  const plain = html(ANSWER, false);
  const wrapped = html(ANSWER, true);
  assert.equal(textOf(wrapped), textOf(plain));
  assert.match(wrapped, /<code class="inline rich-w">wait<\/code>/);
  assert.match(wrapped, /<strong><span class="rich-w">last<\/span> <span class="rich-w">call<\/span><\/strong>/);
  assert.equal(wrapped.match(/class="rich-w"/g)?.length, 17);
});

test('without word fade (finished answers, reduced motion) nothing is wrapped', () => {
  assert.ok(!html(ANSWER, false).includes('rich-w'));
  assert.ok(!html(`${ANSWER}\n\n- one more point`, false, true).includes('rich-w'));
});

test('only the last text part fades: words before a code fence are already finished', () => {
  const markup = html('Before the code.\n```js\nrun();\n```\nAfter it.', true);
  assert.ok(!/rich-w">Before/.test(markup));
  assert.match(markup, /<span class="rich-w">After<\/span> <span class="rich-w">it.<\/span>/);
});

test('a short answer fades its words too, in whichever part is still arriving', () => {
  const short = (text: string) => renderToStaticMarkup(createElement(ShortAnswer, { text, streaming: true, words: true }));
  assert.match(short('It waits for quiet.'), /<span class="rich-w">waits<\/span>/);
  const withUnsure = short('It waits for quiet. Not sure: the exact delay.');
  assert.ok(!/rich-w">waits/.test(withUnsure), 'the finished paragraph is plain');
  assert.match(withUnsure, /short-answer__unsure.*<span class="rich-w">delay.<\/span>/);
});
