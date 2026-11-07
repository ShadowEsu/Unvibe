import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { DepthControl } from '../src/renderer/widget/levelChip';
import type { ExplanationLevel } from '../src/core/protocol';

const noop = () => undefined;
const control = (level: ExplanationLevel, plan?: string) =>
  renderToStaticMarkup(createElement(DepthControl, { level, plan, disabled: false, onPick: noop }));
const expertTag = (html: string) => /<button[^>]*data-level="expert"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? '';

test('the depth control is one radio group of all five, in order, with only the current one checked', () => {
  const html = control('beginner', 'pro');
  assert.match(html, /^<div class="ob-depth" role="radiogroup" aria-label="Explanation depth"/);
  const items = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(items.map((b) => /data-level="(\w+)"/.exec(b)?.[1]), ['new', 'beginner', 'intermediate', 'advanced', 'expert']);
  assert.ok(items.every((b) => b.includes('role="radio"')));
  assert.deepEqual(items.map((b) => /aria-checked="(\w+)"/.exec(b)?.[1]), ['false', 'true', 'false', 'false', 'false']);
  assert.deepEqual(items.map((b) => /tabindex="(-?\d)"/.exec(b)?.[1]), ['-1', '0', '-1', '-1', '-1'], 'one tab stop, on the current depth');
  assert.ok(!html.includes('disabled=""'), 'nothing is locked on Pro');
});

test('Expert always keeps its Pro marker, and is locked unless the plan includes it', () => {
  for (const plan of [undefined, 'free', 'trial']) {
    const expert = expertTag(control('beginner', plan));
    assert.match(expert, /\sdisabled=""/, String(plan));
    assert.match(expert, /<span class="ob-pro"><svg[^>]*aria-hidden="true"/, 'a lock before Pro');
    assert.match(expert, />Pro<\/span>/);
  }
  for (const plan of ['pro', 'teams', 'full']) {
    const expert = expertTag(control('beginner', plan));
    assert.ok(!expert.includes('disabled'), plan);
    assert.match(expert, /<span class="ob-pro">Pro<\/span>/, `${plan}: the marker stays`);
  }
});
