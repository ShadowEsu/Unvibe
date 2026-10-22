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
import { initWidget, runReview, startComprehension, type ReviewSession } from '../src/main/review';
import { store } from '../src/main/store';

/** Every request body the backend received, by path. */
const received: Array<{ path: string; body: ReviewRequestPayload }> = [];

/** A backend that explains code, answers questions differently, and writes one quiz question. */
net.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as ReviewRequestPayload) : ({} as ReviewRequestPayload);
  received.push({ path: url.pathname, body });
  if (url.pathname === '/api/v1/reviews') {
    const text = body.question
      ? `ANSWER to "${body.question}"`
      : `EXPLANATION at ${body.level}${body.variant === 'different' ? ' (different)' : ''} of a debounce helper that waits for quiet input.`;
    const events = [{ type: 'token', text }, { type: 'done', model: 'test', mock: false }];
    return new Response(events.map((ev) => `data: ${JSON.stringify(ev)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
  }
  if (url.pathname === '/api/v1/comprehension') {
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
