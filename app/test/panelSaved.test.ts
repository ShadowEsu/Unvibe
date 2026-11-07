import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app } from './electronStub';

// The store lives under userData; give this file its own so nothing else is touched.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-panel-saved-'));
app.getPath = (): string => userData;

import type { LocalEvent } from '../src/core/learning';
import { openSavedLesson, savedLessons } from '../src/main/panelSaved';
import { store } from '../src/main/store';

function lesson(id: string, minutesAgo: number, over: Partial<LocalEvent> = {}): LocalEvent {
  const ts = new Date(Date.UTC(2026, 0, 10, 12, 0) - minutesAgo * 60_000).toISOString();
  return {
    id,
    ts,
    eventType: 'explanation_completed',
    localDate: ts.slice(0, 10),
    timezone: 'UTC',
    scope: 'selection',
    level: 'beginner',
    outcome: 'reviewed',
    lines: 2,
    language: 'javascript',
    code: `\nconst ${id} = values.map((v) => v * 2);\nexport default ${id};`,
    explanation: `Explains ${id}.`,
    ...over,
  };
}

test('Saved lists pinned lessons first, then Recent without them, newest first; lessons with no text are left out', () => {
  const events = [lesson('a', 30), lesson('b', 20), lesson('c', 10), lesson('empty', 5, { explanation: '  ' })];
  const lists = savedLessons(events, ['a', 'gone']);
  assert.deepEqual(lists.pinned.map((r) => r.id), ['a'], 'an unknown pinned id is skipped');
  assert.deepEqual(lists.recent.map((r) => r.id), ['c', 'b']);
  assert.equal(lists.recent[0]!.firstLine, 'const c = values.map((v) => v * 2);');
  assert.equal(savedLessons(events, [], 1).recent.length, 1);
});

test('opening a saved lesson reads only the store: it works when the file is gone, and an unknown id says so', () => {
  const saved = lesson('d', 1, { file: '/no/such/file/anymore.js' });
  const lookups: string[] = [];
  const opened = openSavedLesson((id) => { lookups.push(id); return id === 'd' ? saved : undefined; }, ['d'], 'd');
  assert.deepEqual(lookups, ['d']);
  assert.ok(opened.ok);
  assert.equal(opened.lesson.explanation, 'Explains d.');
  assert.equal(opened.lesson.code, saved.code);
  assert.equal(opened.lesson.pinned, true);
  for (const id of ['nope', '', 7]) {
    assert.deepEqual(openSavedLesson(() => undefined, [], id), { ok: false, error: 'That lesson is no longer on this Mac.' });
  }
});

test('the panel never reopens a lesson through a fresh review, so opening one spends no explanation', () => {
  const dir = path.resolve(__dirname, '../src/renderer/widget');
  for (const name of readdirSync(dir).filter((file) => /\.tsx?$/.test(file))) {
    const source = readFileSync(path.join(dir, name), 'utf8');
    assert.ok(!/reopenLearningItem|reopenItem/.test(source), name);
  }
});

test('Save pins a stored lesson (newest pin first), unpins it, and forgetting the lesson drops its pin', () => {
  store().recordReview(lesson('p1', 3));
  store().recordReview(lesson('p2', 2));
  assert.equal(store().setPinned('p1', true), true);
  assert.equal(store().setPinned('p2', true), true);
  assert.deepEqual(store().pinnedIds(), ['p2', 'p1']);
  assert.equal(store().setPinned('p1', true), true);
  assert.deepEqual(store().pinnedIds(), ['p1', 'p2'], 'pinning again moves it to the top, once');
  assert.equal(store().setPinned('p2', false), true);
  assert.deepEqual(store().pinnedIds(), ['p1']);
  assert.equal(store().setPinned('missing', true), false);
  store().forgetEvent('p1');
  assert.deepEqual(store().pinnedIds(), []);
});
