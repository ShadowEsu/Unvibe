import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ShortAnswer, offersMoreDetail, revealShortAnswer, sentencesOf, splitUnsure, waitingStatus } from '../src/renderer/shared/shortAnswer';

test('the "Not sure:" sentence is split off only where a sentence starts', () => {
  assert.deepEqual(splitUnsure('It adds prices. Not sure: where items comes from.'), { main: 'It adds prices.', unsure: 'Not sure: where items comes from.' });
  assert.deepEqual(splitUnsure('Not sure: nothing is shown.'), { main: '', unsure: 'Not sure: nothing is shown.' });
  assert.deepEqual(splitUnsure('It logs "Not sure: retry" and returns.'), { main: 'It logs "Not sure: retry" and returns.', unsure: '' });
  assert.deepEqual(splitUnsure('It adds prices.'), { main: 'It adds prices.', unsure: '' });
});

test('the short answer renders the sentences, then the uncertainty line in its own quiet block', () => {
  const html = renderToStaticMarkup(createElement(ShortAnswer, { text: 'It adds prices. Not sure: where items comes from.' }));
  assert.match(html, /^<div class="short-answer"><p>It adds prices\.<\/p><div class="short-answer__unsure"><p>Not sure: where items comes from\.<\/p><\/div><\/div>$/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ShortAnswer, { text: 'It adds prices.' })), /short-answer__unsure/);
});

test('the waiting line says how much of which language is being read', () => {
  assert.equal(waitingStatus(24, 'typescript'), 'Reading 24 lines of TypeScript…');
  assert.equal(waitingStatus(1, 'python'), 'Reading 1 line of Python…');
  assert.equal(waitingStatus(3, 'unknown'), 'Reading 3 lines of code…');
  assert.equal(waitingStatus(3), 'Reading 3 lines of code…');
  assert.equal(waitingStatus(undefined, 'typescript'), 'Reading your request…');
});

const texts = (text: string, ended: boolean) => sentencesOf(text, ended).map((s) => s.text);

test('a streamed sentence shows only once its end punctuation and a space have arrived, or the stream ends', () => {
  assert.deepEqual(texts('It adds the pri', false), []);
  assert.deepEqual(texts('It adds the prices.', false), [], 'the next token may still be "json" in "config.json"');
  assert.deepEqual(texts('It adds the prices. Then it rou', false), ['It adds the prices.']);
  assert.deepEqual(texts('It adds the prices. Then it rounds', true), ['It adds the prices.', 'Then it rounds']);
  assert.deepEqual(texts('It reads config.json and the cart. Then', false), ['It reads config.json and the cart.']);
  assert.deepEqual(texts('It costs 3.5 dollars! Is that right? Yes', false), ['It costs 3.5 dollars!', 'Is that right?']);
});

test('a period inside `code` or **bold** does not end the sentence', () => {
  assert.deepEqual(texts('It calls `a. b` here. Next', false), ['It calls `a. b` here.']);
  assert.deepEqual(texts('It is **not. done** yet', false), []);
  assert.deepEqual(texts('**It adds.** Then it', false), ['**It adds.**']);
  assert.deepEqual(texts('It says "stop." Then', false), ['It says "stop."']);
});

test('a blank line ends a paragraph, and the next sentence starts the next one', () => {
  assert.deepEqual(sentencesOf('One. Two.\n\nThree. ', false).map((s) => [s.text, s.paragraph]), [['One.', 0], ['Two.', 0], ['Three.', 1]]);
});

test('the "Not sure:" line completes the sentences before it and waits for the end of the stream', () => {
  const streaming = revealShortAnswer('It adds prices. It rounds them. Not sure: where it', true);
  assert.deepEqual(streaming.sentences.map((s) => s.text), ['It adds prices.', 'It rounds them.']);
  assert.equal(streaming.unsure, '');
  const half = revealShortAnswer('It adds prices. It rounds them', true);
  assert.deepEqual(half.sentences.map((s) => s.text), ['It adds prices.']);
  const done = revealShortAnswer('It adds prices. It rounds them. Not sure: where items comes from.', false);
  assert.deepEqual(done.sentences.map((s) => s.text), ['It adds prices.', 'It rounds them.']);
  assert.equal(done.unsure, 'Not sure: where items comes from.');
});

test('More detail mounts only once the whole answer is on screen', () => {
  assert.equal(offersMoreDetail('streaming', true, 0, 80), false, 'not while the short answer streams');
  assert.equal(offersMoreDetail('done', true, 0, 80), true, 'a short answer is all on screen when its stream ends');
  assert.equal(offersMoreDetail('done', false, 80, 80), false, 'only short answers offer it');
  assert.equal(offersMoreDetail('error', true, 0, 80), false);
});

test('a short answer that streamed keeps no partial sentence and no caret on screen', () => {
  const html = renderToStaticMarkup(createElement(ShortAnswer, { text: 'It adds prices. It roun', streaming: true }));
  assert.match(html, /It adds prices\./);
  assert.doesNotMatch(html, /It roun/);
  assert.doesNotMatch(html, /class="cursor"/);
  const waiting = renderToStaticMarkup(createElement(ShortAnswer, { text: 'It ad', streaming: true, status: 'Reading 2 lines of Go…' }));
  assert.match(waiting, /Reading 2 lines of Go…/);
  assert.doesNotMatch(waiting, /It ad/);
});
