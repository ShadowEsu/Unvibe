import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, net } from './electronStub';

// The store and settings live under userData; give this file its own so nothing else is touched.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-review-session-'));
app.getPath = (): string => userData;

import type { BrowserWindow } from 'electron';
import type { ReviewRequestPayload } from '../src/core/protocol';
import { gradeComprehension, initWidget, markUnderstood, runReview, startComprehension, type ReviewSession } from '../src/main/review';
import { store } from '../src/main/store';

/** Every request body the backend received, by path. */
const received: Array<{ path: string; body: ReviewRequestPayload }> = [];

/** When set, the question service answers with this HTTP status instead of a question. */
let quizStatus: number | null = null;
/** When set, the explanation service refuses with this response instead of explaining. */
let reviewRefusal: { status: number; body: Record<string, unknown> } | null = null;
/** When set, the explanation service streams these events instead of explaining. */
let reviewEvents: object[] | null = null;
/** When set, runs just before the explanation service answers (the request is already out). */
let beforeReviewAnswer: (() => void) | null = null;

/** A backend that explains code, answers questions differently, and writes one quiz question. */
net.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as ReviewRequestPayload) : ({} as ReviewRequestPayload);
  received.push({ path: url.pathname, body });
  if (url.pathname === '/api/v1/reviews') {
    beforeReviewAnswer?.();
    if (reviewRefusal) return Response.json(reviewRefusal.body, { status: reviewRefusal.status });
    const text = body.question
      ? `ANSWER to "${body.question}"`
      : `EXPLANATION at ${body.level}${body.variant === 'different' ? ' (different)' : ''} of a debounce helper that waits for quiet input.`;
    const events = reviewEvents ?? [{ type: 'token', text }, { type: 'done', model: 'test', mock: false }];
    return new Response(events.map((ev) => `data: ${JSON.stringify(ev)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
  }
  if (url.pathname === '/api/v1/comprehension') {
    if (quizStatus) return Response.json({ error: 'unavailable' }, { status: quizStatus });
    return Response.json({ question: 'What does wait control?', options: ['Delay', 'Retries', 'Size', 'Order'], answerIndex: 0, concept: 'debounce', conceptLabel: 'Debounce', rationale: 'It is the quiet period.' });
  }
  return Response.json({ error: 'not_found' }, { status: 404 });
};

function panel(): { win: BrowserWindow; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  // Only webContents.send is used by the review module; the rest of BrowserWindow is irrelevant here.
  const win = { isDestroyed: () => false, webContents: { send: (_channel: string, ev: Record<string, unknown>) => events.push(ev) } } as unknown as BrowserWindow;
  return { win, events };
}

function session(level: ReviewSession['level']): ReviewSession {
  return {
    reviewId: `rv-${Math.random().toString(36).slice(2)}`,
    tabId: '1',
    code: 'function debounce(fn, wait) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}',
    sourceApp: 'Terminal',
    abort: null,
    recorded: false,
    level,
    mode: 'selection',
  };
}

const lesson = (id: string) => store().eventById(id);
const reviewBodies = () => received.filter((r) => r.path === '/api/v1/reviews').map((r) => r.body);

test('the panel is told the session depth, so a Beginner default shows and stays Beginner', () => {
  const { win, events } = panel();
  initWidget(win, session('beginner'), { autoStart: true });
  const init = events.find((ev) => ev.type === 'init');
  assert.equal(init?.level, 'beginner');
});

test('a follow-up answer never replaces the saved explanation, and the question does not stick', async () => {
  received.length = 0;
  const { win } = panel();
  const s = session('beginner');
  await runReview(win, s, { level: 'beginner' });
  const original = lesson(s.reviewId)?.explanation;
  assert.match(original ?? '', /^EXPLANATION at beginner/);

  await runReview(win, s, { level: 'beginner', question: 'What if wait is 0?' });
  assert.equal(reviewBodies().at(-1)?.question, 'What if wait is 0?');
  assert.equal(lesson(s.reviewId)?.explanation, original, 'the lesson keeps the explanation of the code');

  // A later depth change is an explanation again, not a second answer to the old question.
  await runReview(win, s, { level: 'advanced' });
  assert.equal(reviewBodies().at(-1)?.question, undefined);
  assert.match(lesson(s.reviewId)?.explanation ?? '', /^EXPLANATION at advanced/);

  // Test me quizzes the code, not the follow-up.
  await startComprehension(win, s);
  const quiz = received.filter((r) => r.path === '/api/v1/comprehension').at(-1)?.body;
  assert.equal(quiz?.question, undefined);
});

test('"Explain differently" applies to that request only', async () => {
  received.length = 0;
  const { win } = panel();
  const s = session('intermediate');
  await runReview(win, s, { level: 'intermediate' });
  await runReview(win, s, { level: 'intermediate', variant: 'different' });
  assert.equal(reviewBodies().at(-1)?.variant, 'different');
  assert.match(lesson(s.reviewId)?.explanation ?? '', /\(different\)/);
  await runReview(win, s, { level: 'advanced' });
  assert.equal(reviewBodies().at(-1)?.variant, 'default');
});

test('a Test me failure stays in the quiz and leaves the finished explanation on screen', async () => {
  const { win, events } = panel();
  const s = session('intermediate');
  await runReview(win, s, { level: 'intermediate' });
  const before = events.length;
  quizStatus = 503;
  try {
    await startComprehension(win, s);
  } finally {
    quizStatus = null;
  }
  const after = events.slice(before);
  // A panel-level error replaces the explanation with "Couldn't explain that" and a Retry that re-runs (and re-meters) it.
  assert.deepEqual(after.filter((ev) => ev.type === 'error'), []);
  assert.equal(after.filter((ev) => ev.type === 'quizError').length, 1);
  assert.match(lesson(s.reviewId)?.explanation ?? '', /^EXPLANATION at intermediate/);
});

test('a server 402 pro_required opens the Pro upgrade panel, not the plan limit', async () => {
  const { win, events } = panel();
  const s = session('intermediate');
  reviewRefusal = { status: 402, body: { error: 'pro_required', message: 'Git diff explanations, change briefs and since last understood compares are included with Unvibe Pro.', upgradePath: '/plan' } };
  try {
    await runReview(win, s, { level: 'intermediate' });
  } finally {
    reviewRefusal = null;
  }
  const errors = events.filter((ev) => ev.type === 'error');
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.code, 'pro_required');
  assert.equal(errors[0]?.upgradePath, '/plan');
  assert.match(String(errors[0]?.message), /included with Unvibe Pro/);
});

test('the service\'s error text reaches the panel only as a capped string, streamed or refused', async () => {
  const hostile: unknown[] = [{ html: '<img src=x onerror=alert(1)>' }, ['a'], 42, '   '];
  const firstError = async (setup: () => void): Promise<unknown> => {
    const { win, events } = panel();
    setup();
    try {
      await runReview(win, session('intermediate'), { level: 'intermediate' });
    } finally {
      reviewEvents = null;
      reviewRefusal = null;
    }
    return events.find((ev) => ev.type === 'error')?.message;
  };
  assert.equal(await firstError(() => { reviewEvents = [{ type: 'error', message: ` ${'r'.repeat(1_000)} ` }]; }), 'r'.repeat(300));
  assert.equal(await firstError(() => { reviewRefusal = { status: 413, body: { error: 'too_long', message: 'q'.repeat(1_000) } }; }), 'q'.repeat(300));
  for (const message of hostile) {
    assert.equal(await firstError(() => { reviewEvents = [{ type: 'error', message }]; }), 'The explanation service could not complete that request. Please try again.', `streamed ${JSON.stringify(message)}`);
    assert.equal(
      await firstError(() => { reviewRefusal = { status: 429, body: { error: 'plan_limit_reached', message } }; }),
      'You have used this plan\'s explanations for now. Open Plan & usage to see when they reset or to upgrade.',
      `refused ${JSON.stringify(message)}`,
    );
  }
});

test('a review that started before a wipe saves no lesson when its answer arrives, and the next run does', async () => {
  const { win, events } = panel();
  const s = session('intermediate');
  // The wipe (account deletion or Erase everything) lands while the request is out; this panel was not closed.
  beforeReviewAnswer = () => store().wipeEverything();
  try {
    await runReview(win, s, { level: 'intermediate' });
  } finally {
    beforeReviewAnswer = null;
  }
  assert.ok(events.some((ev) => ev.type === 'done'), 'the answer still arrived');
  assert.equal(lesson(s.reviewId), undefined, 'no lesson written into the wiped store');
  assert.deepEqual(store().events(), []);
  await runReview(win, s, { level: 'intermediate' });
  assert.match(lesson(s.reviewId)?.explanation ?? '', /^EXPLANATION at intermediate/, 'a run started after the wipe is saved');
});

test('"Got it" on a panel that outlived a wipe saves no file snapshot; after a new run it does', async () => {
  const { win, events } = panel();
  const file = `wipe-${Math.random().toString(36).slice(2)}.js`;
  const s: ReviewSession = { ...session('intermediate'), file, snapshotText: 'function debounce(fn, wait) {}' };
  await runReview(win, s, { level: 'intermediate' });
  assert.ok(lesson(s.reviewId), 'the run was saved before the wipe');
  // The wipe lands while this panel is still open, then the person presses Got it.
  store().wipeEverything();
  markUnderstood(win, s);
  assert.equal(store().fileSnapshot(file), undefined, 'no snapshot written into the wiped store');
  assert.deepEqual(store().events(), []);
  assert.ok(!events.some((ev) => ev.type === 'understood'));
  // A run started after the wipe is new learning: Got it saves it and its snapshot.
  await runReview(win, s, { level: 'intermediate' });
  markUnderstood(win, s);
  assert.ok(store().fileSnapshot(file), 'a run started after the wipe saves its snapshot');
  assert.equal(lesson(s.reviewId)?.outcome, 'understood');
});

test('a correct quiz answer on a panel that outlived a wipe saves no snapshot; after a new run it does', async () => {
  const { win, events } = panel();
  const file = `quiz-wipe-${Math.random().toString(36).slice(2)}.js`;
  const s: ReviewSession = { ...session('intermediate'), file, snapshotText: 'function debounce(fn, wait) {}' };
  await runReview(win, s, { level: 'intermediate' });
  await startComprehension(win, s);
  assert.ok(lesson(s.reviewId));
  store().wipeEverything();
  gradeComprehension(win, s, 0);
  assert.equal(store().fileSnapshot(file), undefined, 'no snapshot written into the wiped store');
  assert.deepEqual(store().events(), []);
  assert.ok(!events.some((ev) => ev.type === 'graded'));
  await runReview(win, s, { level: 'intermediate' });
  await startComprehension(win, s);
  gradeComprehension(win, s, 0);
  assert.ok(store().fileSnapshot(file));
  assert.equal(lesson(s.reviewId)?.outcome, 'understood');
});

test('review streams forward only the token, done and error events the service sends', async () => {
  const appOnly = ['init', 'understood', 'status', 'consent', 'blocked', 'quizError', 'cancelled', 'question', 'graded', 'usage'];
  const { win, events } = panel();
  // Forwarded events are rebuilt without extra fields, so the stream's own values mark them.
  reviewEvents = [...appOnly, 'token', 'error', 'unhandled', 'constructor', '', 'done'].map((type) => ({
    type, text: 'marker words', message: 'marker notice', model: 'marker-model', mock: false,
  }));
  try {
    await runReview(win, session('intermediate'), { level: 'intermediate' });
  } finally {
    reviewEvents = null;
  }
  const fromStream = events.filter((ev) => ev.text === 'marker words' || ev.message === 'marker notice' || ev.model === 'marker-model');
  assert.deepEqual(fromStream.map((ev) => ev.type), ['token', 'error', 'done']);
});

test('streamed token, done and error events reach the panel with only their checked fields', async () => {
  const { win, events } = panel();
  const extras = { html: '<img src=x onerror=alert(1)>', extra: { nested: { deep: ['x'] } }, tabId: 'other-tab' };
  reviewEvents = [
    { type: 'token', text: 'Kept words.', ...extras },
    { type: 'token', text: { html: '<b>not text</b>' }, ...extras },
    { type: 'error', message: { html: '<b>x</b>' }, code: 'pro_required', upgradePath: 'https://elsewhere.test', ...extras },
    { type: 'done', model: 'service-model', mock: 'yes', ...extras },
    { type: 'done', model: { name: 'x' }, mock: true, ...extras },
  ];
  try {
    await runReview(win, session('intermediate'), { level: 'intermediate' });
  } finally {
    reviewEvents = null;
  }
  const streamed = events.filter((ev) => ev.type === 'token' || ev.type === 'done' || ev.type === 'error');
  assert.deepEqual(streamed, [
    { type: 'token', text: 'Kept words.', tabId: '1' },
    { type: 'error', message: 'The explanation service could not complete that request. Please try again.', tabId: '1' },
    { type: 'done', model: 'service-model', mock: false, tabId: '1' },
    { type: 'done', model: undefined, mock: true, tabId: '1' },
  ]);
  for (const ev of streamed) {
    const expected = ev.type === 'token' ? ['tabId', 'text', 'type'] : ev.type === 'error' ? ['message', 'tabId', 'type'] : ['mock', 'model', 'tabId', 'type'];
    assert.deepEqual(Object.keys(ev).sort(), expected);
    assert.ok(Object.values(ev).every((value) => value === undefined || typeof value === 'string' || typeof value === 'boolean'), JSON.stringify(ev));
  }
});
