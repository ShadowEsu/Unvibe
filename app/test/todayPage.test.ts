import test from 'node:test';
import assert from 'node:assert/strict';
import { todayFirstRun, weekSentence } from '../src/renderer/companion/today';

test('the week reads as one sentence built from the four counts (Design C1)', () => {
  assert.equal(
    weekSentence({ explanations: 12, linesExplained: 52, linesUnderstood: 20, concepts: 2 }),
    'This week: 12 explanations, 52 lines explained, 20 lines understood, 2 concepts.',
  );
});

test('a count of one is singular in the week sentence', () => {
  assert.equal(
    weekSentence({ explanations: 1, linesExplained: 1, linesUnderstood: 1, concepts: 1 }),
    'This week: 1 explanation, 1 line explained, 1 line understood, 1 concept.',
  );
});

test('a zero count gets no clause, except explanations', () => {
  assert.equal(weekSentence({ explanations: 3, linesExplained: 14, linesUnderstood: 0, concepts: 0 }), 'This week: 3 explanations, 14 lines explained.');
  assert.equal(weekSentence({ explanations: 2, linesExplained: 9, linesUnderstood: 0, concepts: 1 }), 'This week: 2 explanations, 9 lines explained, 1 concept.');
  assert.equal(weekSentence({ explanations: 0, linesExplained: 4, linesUnderstood: 0, concepts: 0 }), 'This week: no explanations yet, 4 lines explained.');
  assert.equal(weekSentence({ explanations: 0, linesExplained: 0, linesUnderstood: 0, concepts: 0 }), 'This week: no explanations yet.');
});

test('the Explain banner and the Try voice card show only while Today is empty (Design C1)', () => {
  assert.deepEqual(todayFirstRun({ reviews: 0 }), { explainBanner: true, voiceCard: true });
  assert.deepEqual(todayFirstRun({ reviews: 1 }), { explainBanner: false, voiceCard: false });
  assert.deepEqual(todayFirstRun({ reviews: 12 }), { explainBanner: false, voiceCard: false });
  // Still loading: nothing known, so no first-run card flashes on a filled profile.
  assert.deepEqual(todayFirstRun(null), { explainBanner: false, voiceCard: false });
});
