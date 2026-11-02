import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ShortAnswer, splitUnsure } from '../src/renderer/shared/shortAnswer';

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
