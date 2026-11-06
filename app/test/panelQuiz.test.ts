import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { QuizActions, QuizCard, quizKicker, type Quiz } from '../src/renderer/widget/panelQuiz';

const noop = () => undefined;
const base: Quiz = {
  phase: 'answering', question: 'When does fn run?', options: ['On the first call', 'Every 300 ms', 'Once, 300 ms after the last call', 'Never'], index: 1, total: 3, mode: 'scenario',
};
const card = (quiz: Quiz) => renderToStaticMarkup(createElement(QuizCard, { quiz, onChoose: noop }));
const graded = (over: Partial<Quiz>): Quiz => ({ ...base, phase: 'graded', choice: 2, answerIndex: 2, correct: true, rationale: 'Every call clears the old timer.', ...over });
const bubble = (html: string) => /<p class="vibe-bubble"[^>]*>(.*?)<\/p>/.exec(html)?.[1] ?? '';
const actions = (quiz: Quiz) => [...renderToStaticMarkup(createElement(QuizActions, { quiz, onCheck: noop, onAnother: noop, onRetry: noop, onClose: noop }))
  .matchAll(/<button[^>]*class="([^"]+)"[^>]*>(.*?)<\/button>/g)].map((m) => `${m[1]}:${m[2].replace(/<[^>]+>/g, '')}`);

test('the kicker says where you are and what kind of question it is', () => {
  assert.equal(quizKicker(base), 'Test me · 1 of 3 · Prove it');
  assert.equal(quizKicker({ ...base, index: 2, mode: 'recall' }), 'Test me · 2 of 3 · Recall');
  assert.equal(quizKicker({ ...base, mode: 'quick-check', total: 1 }), 'Test me');
});

test('each verdict is Vibe speaking in its bubble, verbatim, with the matching mood', () => {
  const cases: Array<[Partial<Quiz>, string, string, string]> = [
    [{ correct: true }, 'Correct. That one is understood.', 'celebrate', 'ok'],
    [{ correct: true, hasMissed: true }, 'Correct. Earlier misses are saved to revisit.', 'celebrate', 'ok'],
    [{ correct: false, choice: 0 }, 'Not quite. Saved to revisit.', 'confused', 'no'],
  ];
  for (const [over, verdict, mood, kind] of cases) {
    const html = card(graded(over));
    assert.ok(bubble(html).endsWith(verdict), verdict);
    assert.match(html, new RegExp(`<div class="verdict ${kind}">`), verdict);
    assert.match(html, new RegExp(`<span aria-hidden="true"><[^>]*class="buddy buddy--${mood}`), 'Vibe beside the bubble is decoration; the bubble names it');
  }
});

test('once graded, only the right option shows the lime tick, and a wrong pick is marked', () => {
  const html = card(graded({ correct: false, choice: 0 }));
  const opts = [...html.matchAll(/<button[^>]*class="(opt[^"]*)"[^>]*><em aria-hidden="true">(.*?)<\/em>/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(opts, ['opt wrong:A', 'opt:B', 'opt right:✓', 'opt:D']);
});

test('the end line is plain text under the bubble, and only after the last question', () => {
  assert.ok(!card(graded({ index: 1 })).includes('quiz__end'));
  const last = card(graded({ index: 3 }));
  assert.match(last, /<p class="quiz__end">All three right\.<\/p>/);
  assert.ok(!bubble(last).includes('All three right'));
  assert.match(card(graded({ index: 3, hasMissed: true })), /That&#x27;s all three for this code\. Missed ones come back in your review queue\./);
});

test('the question can take focus and the choice is announced as pressed until graded', () => {
  const html = card({ ...base, choice: 1 });
  const h2 = /<h2([^>]*)>When does fn run\?<\/h2>/.exec(html)?.[1] ?? '';
  assert.match(h2, /class="quiz__q"/);
  assert.match(h2, /tabindex="-1"/);
  assert.match(html, /class="opt sel" aria-pressed="true"/);
  assert.ok(!card(graded({})).includes('aria-pressed'));
});

test('the footer offers one primary for where you are and a quiet way out', () => {
  assert.deepEqual(actions(base), ['btn-primary:Check', 'btn-quiet:Cancel']);
  assert.deepEqual(actions({ ...base, phase: 'grading', choice: 1 }), ['btn-primary:Checking…', 'btn-quiet:Cancel']);
  assert.deepEqual(actions(graded({ index: 1 })), ['btn-primary:Another question', 'btn-quiet:Hide question']);
  assert.deepEqual(actions(graded({ index: 3 })), ['btn-primary:Hide question']);
  assert.deepEqual(actions({ phase: 'failed', error: 'x' }), ['btn-primary:Try again', 'btn-quiet:Hide']);
  assert.deepEqual(actions({ phase: 'loading' }), ['btn-quiet:Cancel']);
});
