import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from './electronStub';

// The store lives under userData; give this file its own so nothing else is touched.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-learning-changed-'));
app.getPath = (): string => userData;

import type { LocalEvent } from '../src/core/learning';
import { onLearningChanged, store } from '../src/main/store';

function lesson(id: string, ts = new Date().toISOString()): LocalEvent {
  return {
    id,
    ts,
    eventType: 'explanation_completed',
    localDate: ts.slice(0, 10),
    timezone: 'UTC',
    scope: 'selection',
    level: 'beginner',
    outcome: 'reviewed',
    lines: 3,
    code: 'const doubled = values.map((v) => v * 2);',
    explanation: 'Doubles every value.',
  };
}

/** Runs `change` and returns how many times the companion would have been told to refresh. */
function notifications(change: () => void): number {
  let count = 0;
  const off = onLearningChanged(() => { count += 1; });
  try {
    change();
  } finally {
    off();
  }
  return count;
}

test('every change the companion lists (saved, checked, edited, synced in, removed) tells it to refresh', () => {
  const s = store();
  assert.equal(notifications(() => s.recordReview(lesson('a'))), 1, 'a new lesson');
  assert.equal(notifications(() => s.setOutcome('a', 'understood')), 1, 'Understand / Test me result');
  assert.equal(notifications(() => s.updateLesson('a', { note: 'remember the map' })), 1, 'note or re-run body');
  assert.equal(notifications(() => s.mergeRemote([lesson('from-other-mac')])), 1, 'a lesson synced from another device');
  assert.equal(notifications(() => s.ensureDayActive()), 0, 'today is already active from the lessons above');
  assert.equal(notifications(() => s.forgetEvent('a')), 1, 'a removed lesson');
  assert.equal(notifications(() => s.wipeEverything()), 1, 'Delete all local data');
  assert.equal(notifications(() => s.ensureDayActive()), 1, 'the streak day after a wipe');
});

test('upload bookkeeping and missing lessons do not refresh the companion', () => {
  const s = store();
  s.recordReview(lesson('b'));
  assert.equal(notifications(() => s.markSynced(['b'])), 0);
  assert.equal(notifications(() => s.setOutcome('missing', 'understood')), 0);
  assert.equal(notifications(() => s.updateLesson('missing', { note: 'x' })), 0);
  assert.equal(notifications(() => s.mergeRemote([])), 0);
});

test('a failing listener never turns a saved lesson into a save error, and later listeners still run', () => {
  const s = store();
  let later = 0;
  const offBroken = onLearningChanged(() => { throw new Error('companion window is gone'); });
  const offLater = onLearningChanged(() => { later += 1; });
  try {
    assert.doesNotThrow(() => s.recordReview(lesson('c')));
  } finally {
    offBroken();
    offLater();
  }
  assert.equal(later, 1);
  assert.equal(s.eventById('c')?.explanation, 'Doubles every value.');
});
