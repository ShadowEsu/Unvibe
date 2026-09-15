import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { RichText } from '../src/renderer/shared/richText';

function markup(text: string, streaming = false): string {
  return renderToStaticMarkup(createElement(RichText, { text, streaming }));
}

test('rich text renders heading levels without visible markdown markers', () => {
  const html = markup('## What changed\nBody\n\n### Detail\nMore');
  assert.match(html, /<h2[^>]*>What changed<\/h2>/);
  assert.match(html, /<h3[^>]*>Detail<\/h3>/);
  assert.doesNotMatch(html, /## What changed/);
});

test('streaming hides an unfinished heading marker', () => {
  const html = markup('A complete thought.\n\n##', true);
  assert.match(html, /A complete thought\./);
  assert.doesNotMatch(html, />##</);
  assert.match(html, /class="cursor"/);
});

test('rich text escapes HTML and keeps fenced code literal', () => {
  const html = markup('## Safe\n<script>alert(1)</script>\n\n```html\n<img src=x onerror=alert(2)>\n```');
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(/);
  assert.match(html, /\)&gt;<\/pre>/);
});
