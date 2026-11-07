import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { QuizActions, QuizCard, quizCount, quizKind, type Quiz } from '../src/renderer/widget/panelQuiz';

const noop = () => undefined;
const base: Quiz = {
  phase: 'answering', question: 'When does fn run?', options: ['On the first call', 'Every 300 ms', 'Once, 300 ms after the last call', 'Never'], index: 1, total: 3, mode: 'scenario',
};
const card = (quiz: Quiz) => renderToStaticMarkup(createElement(QuizCard, { quiz, depth: 'Advanced', onAnswer: noop }));
const graded = (over: Partial<Quiz>): Quiz => ({ ...base, phase: 'graded', choice: 2, answerIndex: 2, correct: true, rationale: 'Every call clears the old timer.', ...over });
const verdict = (html: string) => /<p class="ob-verdict__line"[^>]*>(.*?)<\/p>/.exec(html)?.[1] ?? '';
const actions = (quiz: Quiz) => [...renderToStaticMarkup(createElement(QuizActions, { quiz, onAnother: noop, onRetry: noop, onClose: noop }))
  .matchAll(/<button[^>]*class="([^"]+)"[^>]*>(.*?)<\/button>/g)].map((m) => `${m[1]}:${m[2].replace(/<[^>]+>/g, '')}`);

test('the kicker says which question this is, and what kind at which depth', () => {
  assert.equal(quizCount(base), 'Question 1 of 3');
  assert.equal(quizCount({ ...base, index: 2 }), 'Question 2 of 3');
  assert.equal(quizKind(base, 'Advanced'), 'Prove it · Advanced');
  assert.equal(quizKind({ ...base, mode: 'quick-check' }, 'Beginner'), 'Beginner');
});

test('each verdict is main\'s line, verbatim, with Vibe in the matching mood', () => {
  const cases: Array<[Partial<Quiz>, string, string, string]> = [
    [{ correct: true }, 'Correct. That one is understood.', 'celebrate', 'is-ok'],
    [{ correct: true, hasMissed: true }, 'Correct. Earlier misses are saved to revisit.', 'celebrate', 'is-ok'],
    [{ correct: false, choice: 0 }, 'Not quite. Saved to revisit.', 'confused', 'is-no'],
  ];
  for (const [over, line, mood, kind] of cases) {
    const html = card(graded(over));
    assert.equal(verdict(html), line);
    assert.match(html, new RegExp(`<div class="ob-verdict ${kind}">`), line);
    assert.match(html, new RegExp(`<span aria-hidden="true"><[^>]*class="buddy buddy--${mood}`), 'Vibe is decoration beside the line');
  }
});

test('rows are lettered A–D; once graded the right one gets the check and a wrong pick the ×', () => {
  const html = card(graded({ correct: false, choice: 0 }));
  const rows = [...html.matchAll(/<button[^>]*class="(ob-opt[^"]*)"[^>]*><em aria-hidden="true">(.)<\/em>/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(rows, ['ob-opt is-picked is-wrong:A', 'ob-opt:B', 'ob-opt is-right:C', 'ob-opt:D']);
  assert.equal((html.match(/ob-opt__mark--right/g) ?? []).length, 1);
  assert.equal((html.match(/ob-opt__mark--wrong/g) ?? []).length, 1);
  assert.ok(!html.includes('✓'), 'JetBrains Mono has no ✓: the check is an icon');
});

test('the end line is plain text under the verdict, and only after the last question', () => {
  assert.ok(!card(graded({ index: 1 })).includes('ob-quiz__end'));
  const last = card(graded({ index: 3 }));
  assert.match(last, /<p class="ob-quiz__end">All three right\.<\/p>/);
  assert.match(card(graded({ index: 3, hasMissed: true })), /That&#x27;s all three for this code\. Missed ones come back in your review queue\./);
});

test('the question can take focus and the rows are pressable until answered', () => {
  const html = card(base);
  const h2 = /<h2([^>]*)>When does fn run\?<\/h2>/.exec(html)?.[1] ?? '';
  assert.match(h2, /class="ob-quiz__q"/);
  assert.match(h2, /tabindex="-1"/);
  assert.equal((html.match(/<button[^>]*disabled=""/g) ?? []).length, 0);
  assert.equal((card(graded({})).match(/<button[^>]*disabled=""/g) ?? []).length, 4);
});

test('the footer offers the next question or a way back, and nothing while a question is open', () => {
  assert.deepEqual(actions(base), []);
  assert.deepEqual(actions(graded({ index: 1 })), ['ob-btn:Another question', 'ob-btn ghost:Hide question']);
  assert.deepEqual(actions(graded({ index: 3 })), ['ob-btn:Hide question']);
  assert.deepEqual(actions({ phase: 'failed', error: 'x' }), ['ob-btn:Try again', 'ob-btn ghost:Hide']);
});
