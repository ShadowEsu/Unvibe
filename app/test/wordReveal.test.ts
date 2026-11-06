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

const TABLE = 'Assume calls at t = 0, 50:\n\n| t (ms) | Event |\n|:--|--:|\n| 0 | call 1: schedule A → t=300 |\n| 50 | call 2: cancel A … |\n\nThat is all.';

/** The tokens either side of a cut: both must carry a letter or digit, with only whitespace between. */
function assertWordCut(full: string, text: string, label: string) {
  assert.match(full.slice(text.length), /^\s+\S/, `${label}: "${text}" ends inside a word`);
  const before = /\S+$/.exec(text)![0];
  const after = /^\s+(\S+)/.exec(full.slice(text.length))![1]!;
  assert.ok(/[\p{L}\p{N}]/u.test(before) && /[\p{L}\p{N}]/u.test(after), `${label}: "${before}" | "${after}" splits a word from its punctuation`);
}

test('the reveal stops only between two words, never takes text back, and ends on the whole answer', () => {
  for (const full of [ANSWER, TABLE]) {
    for (const chunk of [1, 3, 7, 16, 40]) {
      const shown = stream(full, chunk);
      assert.equal(shown.at(-1), full, `chunk ${chunk}`);
      shown.forEach((text, i) => {
        if (i > 0) assert.ok(text.startsWith(shown[i - 1]!) && text.length > shown[i - 1]!.length, `chunk ${chunk}: grows`);
        if (text !== full) assertWordCut(full, text, `chunk ${chunk}`);
      });
    }
  }
});

test('while streaming, the reveal waits until the token after a word is known to be a word; once done the end shows', () => {
  assert.deepEqual(revealStep('The', 'The debounce wai', true), { text: 'The debounce', more: false });
  assert.deepEqual(revealStep('The debounce', 'The debounce wai', true), { text: 'The debounce', more: false });
  assert.deepEqual(revealStep('The debounce', 'The debounce ', true), { text: 'The debounce', more: false });
  assert.deepEqual(revealStep('A', 'A | | 50 | call', true), { text: 'A', more: false }, 'the pipes wait for the next word');
  assert.equal(revealStep('The debounce', 'The debounce wait', false).text, 'The debounce wait');
});

test('punctuation rides with a word: after it, or before the first word of a run', () => {
  const row = html('A | | 50 | call 2: cancel A → t=300', true);
  assert.deepEqual([...row.matchAll(/<span class="rich-w">([^<]*)<\/span>/g)].map((m) => m[1]), ['A | |', '50 |', 'call', '2:', 'cancel', 'A →', 't=300']);
  assert.match(html('— and then it runs', true), /<span class="rich-w">— and<\/span>/);
});

test('word wrapping keeps the text, its spaces, code spans and bold exactly as without it', () => {
  const plain = html(ANSWER, false);
  const wrapped = html(ANSWER, true);
  assert.equal(textOf(wrapped), textOf(plain));
  assert.match(wrapped, /<code class="inline rich-w">wait<\/code>/);
  assert.match(wrapped, /<strong><span class="rich-w">last<\/span> <span class="rich-w">call<\/span><\/strong>/);
  assert.match(wrapped, /<\/strong><span class="rich-w">, then<\/span>/, 'the comma after the bold rides with the next word');
  assert.equal(wrapped.match(/class="rich-w"/g)?.length, 16);
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
