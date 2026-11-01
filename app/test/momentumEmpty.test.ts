import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { Momentum, type MomentumProfile } from '../src/renderer/companion/momentum';
import { LearningEmpty } from '../src/renderer/companion/learn';

const EMPTY: MomentumProfile = { reviews: 0, needsReview: 0, linesUnderstood: 0, linesReviewed: 0, usage: [], heat: Array.from({ length: 182 }, () => 0) };
const FILLED: MomentumProfile = { reviews: 12, needsReview: 4, linesUnderstood: 30, linesReviewed: 60, usage: [{ label: 'Cursor', pct: 100 }], heat: Array.from({ length: 182 }, (_, i) => (i % 7 === 0 ? 2 : 0)) };

const buttons = (html: string): number => html.match(/<button\b/g)?.length ?? 0;

test('empty Momentum names one next step with a verb button, the Library pattern, instead of placeholder tiles (Design A8)', () => {
  for (const profile of [null, EMPTY]) {
    const html = renderToStaticMarkup(createElement(Momentum, { profile, onExplain: () => {} }));
    assert.equal(buttons(html), 1, 'exactly one next step');
    assert.match(html, /class="learning-empty"/, 'the same empty pattern as Library and Quiz');
    assert.doesNotMatch(html, /metric-card/, 'no tiles of dashes');
    assert.doesNotMatch(html, />[–-]</, 'no dash standing in for a value');
  }
});

test('the empty state\'s button starts an explanation', () => {
  let explained = 0;
  const empty = LearningEmpty({ title: 't', detail: 'd', onReview: () => { explained += 1; } }) as ReactElement<{ children: ReactElement[] }>;
  const button = empty.props.children.find((child) => child?.type === 'button') as ReactElement<{ onClick: () => void }>;
  button.props.onClick();
  assert.equal(explained, 1);
});

test('with saved explanations Momentum shows its figures and no empty state, and a tile without data is left out', () => {
  const html = renderToStaticMarkup(createElement(Momentum, { profile: FILLED, onExplain: () => {} }));
  assert.doesNotMatch(html, /learning-empty/);
  assert.match(html, />50%</, 'coverage: 30 of 60 lines');
  assert.match(html, />12</, 'explanations saved');
  // Knowledge loads after mount; until then its tile is absent rather than a "–".
  assert.doesNotMatch(html, />[–-]</);
  assert.equal(html.match(/metric-card/g)?.length, 3);
});
