import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, Fragment } from 'react';
import { renderSummary, RichText } from '../src/renderer/shared/richText';

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

test('single-asterisk and underscore emphasis render as <em>; math, identifiers, bold, code and bullets are untouched', () => {
  assert.match(markup('the timer has *started*'), /the timer has <em>started<\/em>/);
  assert.match(markup('pause *this* function'), /pause <em>this<\/em> function/);
  assert.match(markup('it is _not_ called'), /it is <em>not<\/em> called/);
  assert.match(markup('*two words* here'), /<em>two words<\/em> here/);
  assert.match(markup('2 * 3 * 4'), /2 \* 3 \* 4/);
  assert.match(markup('a*b*c and snake_case_name'), /a\*b\*c and snake_case_name/);
  assert.match(markup('**bold** stays'), /<strong>bold<\/strong> stays/);
  assert.match(markup('`n * n` stays'), /<code class="inline">n \* n<\/code> stays/);
  assert.match(markup('* item one\n* item two'), /<li>item one<\/li><li>item two<\/li>/);
  assert.doesNotMatch(markup('* item one\n* item two'), /<em>/);
});

test('streaming a half-open emphasis shows no stray marker, and the closed word is emphasised after it lands', () => {
  for (const partial of ['The timer has *sta', 'The timer has *sta ', 'The timer has *', 'The timer has _no']) {
    assert.doesNotMatch(markup(partial, true), /[*_]/, partial);
  }
  assert.match(markup('The timer has *sta', true), /<em>sta<\/em>/);
  assert.match(markup('The timer has *started*.', true), /<em>started<\/em>\./);
  assert.match(markup('2 * 3', true), /2 \* 3/);
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

test('a list right under a table stays a list, even when its items hold a pipe', () => {
  const html = markup('| a | b |\n|---|---|\n| 1 | 2 |\n- `x | y` pipes x into y\n- plain item');
  assert.equal(html.match(/<tr>/g)?.length, 2);
  assert.match(html, /<\/table><\/div><ul class="rich-list">/);
  assert.equal(html.match(/<li>/g)?.length, 2);
});

test('a line with pipes but no matching separator row is not a table', () => {
  const prose = [
    'Use `a | b` here.\nNext line.', '| a | b |\n|---|', '| a | b |\n|---|---|---|', 'Intro\n| a | b |',
    // A pipe in a code span or at a line's end, then a rule or a list's first "-" (mid-stream), isn't a table.
    'Run `cat f | grep x` to filter.\n---\nNext.', 'Choose A |\n---', 'Pipe it with `a | b`:\n-', '- `a || b` is OR\n-',
    // A list item with a pipe stays a list item.
    '- a | b\n|---|---|',
  ];
  for (const text of prose) {
    assert.doesNotMatch(markup(text), /<table/, text);
  }
  for (const text of prose.slice(4, 8)) assert.doesNotMatch(markup(text, true), /<table/, `${text} (streaming)`);
  // A paragraph line directly above a table stays a paragraph; the table still renders.
  assert.match(markup('Here it is:\n| a | b |\n|---|---|\n| 1 | 2 |'), /<p>Here it is:<\/p><div class="rich-table"[^>]*><table>/);
});

test('a saved explanation preview shows no raw heading or citation markup (QA 0.1.46 P3)', () => {
  const summary = '## What it does\nRetries `fetch` up to 3 times [[cite:src/lib/retry.ts:1-24]] with **backoff**.';
  const html = renderToStaticMarkup(createElement(Fragment, null, ...renderSummary(summary)));
  assert.doesNotMatch(html, /##|\[\[|cite:|\*\*/);
  assert.match(html, /^What it does Retries <code class="inline">fetch<\/code> up to 3 times <span class="cite"[^>]*>[^<]*retry\.ts[^<]*<\/span> with <strong>backoff<\/strong>\.$/);
});
