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

test('inline code inside a bold list label renders as code, with no raw backticks', () => {
  const html = markup('1. **The check (`!user`):** flips the truthiness.\n2. **`load_config()`**: reads the settings.');
  assert.match(html, /<strong>The check \(<code class="inline">!user<\/code>\):<\/strong>/);
  assert.match(html, /<strong><code class="inline">load_config\(\)<\/code><\/strong>/);
  assert.doesNotMatch(html, /`/);
});

test('a bold label around code that holds an asterisk renders as bold code', () => {
  const html = markup('2. **`n * n`**: squares each number.');
  assert.match(html, /<strong><code class="inline">n \* n<\/code><\/strong>/);
  assert.doesNotMatch(html, /\*\*/);
});

test('streaming renders an unclosed trailing code span or bold label without raw markers', () => {
  assert.match(markup('It checks `isAdu', true), /<code class="inline">isAdu<\/code>/);
  assert.match(markup('1. **The Condition (`if', true), /<strong>The Condition \(<code class="inline">if<\/code><\/strong>/);
  for (const partial of ['1. **The Condition (`if', 'It checks `isAdu', 'Next: **', 'Next: `']) {
    assert.doesNotMatch(markup(partial, true), /`|\*\*/, partial);
  }
});

test('streaming leaves finished lines and open fenced blocks alone', () => {
  const finished = markup('Use a ` mark like this.\nAnd go on', true);
  assert.match(finished, /Use a ` mark like this\./);
  assert.match(markup('```js\nconst a = `x', true), / a = `x<\/pre>/);
});

// QA P3 (20261105-1610): an Advanced follow-up from CI run 42132166462, as the panel received it.
const TIMELINE_ANSWER = [
  '## Timeline',
  '',
  'Assume `wait = 300` and calls at t = 0, 50, 100, 150, 200 ms:',
  '',
  '| t (ms) | Event | Pending timer |',
  '|---|---|---|',
  '| 0 | call 1: `clearTimeout(undefined)` is a no-op; schedule A for t=300 | A |',
  '| 50 | call 2: cancel A; schedule B for t=350 | B |',
  '| 100 | call 3: cancel B; schedule C for t=400 | C |',
  '| 150 | call 4: cancel C; schedule D for t=450 | D |',
  '| 200 | call 5: cancel D; schedule E for t=500 | E |',
  '| ~500 | E fires: `fn(...argsFromCall5)` | none |',
  'Each call resets the countdown, so the delay is measured from the last call, not the first.',
].join('\n');

test('a markdown table in an answer renders as a table, with no raw | rows', () => {
  const html = markup(TIMELINE_ANSWER);
  assert.match(html, /<h2[^>]*>Timeline<\/h2>/);
  assert.equal(html.match(/<th scope="col">/g)?.length, 3);
  assert.equal(html.match(/<tr>/g)?.length, 7);
  assert.match(html, /<th scope="col">t \(ms\)<\/th>/);
  assert.match(html, /<td>call 1: <code class="inline">clearTimeout\(undefined\)<\/code> is a no-op; schedule A for t=300<\/td>/);
  assert.match(html, /<td>~500<\/td><td>E fires: <code class="inline">fn\(\.\.\.argsFromCall5\)<\/code><\/td><td>none<\/td>/);
  assert.doesNotMatch(html, /\|/);
  // The line after the last row isn't a row: it stays its own paragraph.
  assert.match(html, /<\/table><\/div><p>Each call resets the countdown/);
});

test('a pipe inside a code span or escaped as \\| stays in its cell', () => {
  const html = markup('| Code | Means |\n| --- | --- |\n| `a || b` | either |\n| x \\| y | literal |');
  assert.match(html, /<td><code class="inline">a \|\| b<\/code><\/td><td>either<\/td>/);
  assert.match(html, /<td>x \| y<\/td><td>literal<\/td>/);
  assert.equal(html.match(/<td>/g)?.length, 4);
});

test('table columns keep their alignment and short rows are padded to the header', () => {
  const html = markup('| a | b | c |\n|:--|:-:|--:|\n| 1 |');
  assert.match(html, /<th scope="col" class="is-left">a<\/th><th scope="col" class="is-center">b<\/th><th scope="col" class="is-right">c<\/th>/);
  assert.match(html, /<tr><td class="is-left">1<\/td><td class="is-center"><\/td><td class="is-right"><\/td><\/tr>/);
});

test('a line with pipes but no matching separator row is not a table', () => {
  for (const text of ['Use `a | b` here.\nNext line.', '| a | b |\n|---|', '| a | b |\n|---|---|---|', 'Intro\n| a | b |']) {
    assert.doesNotMatch(markup(text), /<table/, text);
  }
  // A paragraph line directly above a table stays a paragraph; the table still renders.
  assert.match(markup('Here it is:\n| a | b |\n|---|---|\n| 1 | 2 |'), /<p>Here it is:<\/p><div class="rich-table"[^>]*><table>/);
});
