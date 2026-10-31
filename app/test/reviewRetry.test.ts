import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, net } from './electronStub';

const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-retry-'));
app.getPath = (): string => userData;

import type { BrowserWindow } from 'electron';
import { FIRST_RUN_SAMPLE } from '../src/core/consent';
import { runReview, type ReviewSession } from '../src/main/review';

/** Explanation requests: 'stall' answers 200 and then sends nothing until the request is aborted. */
let plan: Array<'stall' | 'ok'> = [];
let reviewCalls = 0;
net.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes('/usage')) return Response.json({ used: 0, limit: 50, remaining: 50, resetsAt: '2026-11-28T00:00:00Z', plan: 'trial' });
  if (!url.endsWith('/api/v1/reviews')) throw new Error(`unexpected request ${url}`);
  const kind = plan[reviewCalls] ?? 'ok';
  reviewCalls += 1;
  const headers = { 'content-type': 'text/event-stream', 'x-vercel-id': `iad1::test-${reviewCalls}` };
  if (kind === 'ok') {
    return new Response('data: {"type":"token","text":"ok"}\n\ndata: {"type":"done","model":"test","mock":false}\n\n', { headers });
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
    },
  });
  return new Response(body, { headers });
};
globalThis.fetch = (async () => { throw new Error('Network is disabled in tests.'); }) as typeof fetch;

function panel(): { win: BrowserWindow; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const win = { isDestroyed: () => false, webContents: { send: (_channel: string, ev: Record<string, unknown>) => events.push(ev) } } as unknown as BrowserWindow;
  return { win, events };
}

/** The setup sample, as the first-run flow opens it. */
function sampleSession(): ReviewSession {
  return {
    reviewId: `rv-${Math.random().toString(36).slice(2)}`, tabId: '1', code: FIRST_RUN_SAMPLE, sourceApp: 'Unvibe',
    abort: null, recorded: false, level: 'intermediate', mode: 'selection', isSample: () => true,
  };
}

/** Runs the review while moving the clock past the 30 s first-words limit, until no request is pending. */
async function runWithClock(run: () => Promise<void>, until: () => boolean): Promise<void> {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const done = run();
    for (let i = 0; i < 400 && !until(); i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      mock.timers.tick(1_000);
    }
    await done;
    for (let i = 0; i < 50; i += 1) await new Promise((resolve) => setImmediate(resolve));
  } finally {
    mock.timers.reset();
  }
}

const logs: string[] = [];
const realLog = console.log;
console.log = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
test.after(() => { console.log = realLog; });

test('a first-run sample that gets no words is sent once more, and the person sees the explanation, not an error', async () => {
  plan = ['stall', 'ok'];
  reviewCalls = 0;
  logs.length = 0;
  const { win, events } = panel();
  await runWithClock(() => runReview(win, sampleSession(), { level: 'intermediate' }), () => events.some((ev) => ev.type === 'done' || ev.type === 'error'));
  assert.equal(reviewCalls, 2);
  assert.deepEqual(events.filter((ev) => ev.type === 'error'), []);
  assert.equal(events.filter((ev) => ev.type === 'done').length, 1);
  const trace = logs.filter((line) => line.startsWith('[unvibe-review] '));
  assert.equal(trace.length, 2);
  assert.match(trace[0], /^\[unvibe-review\] id=iad1::test-1 status=200 first_token_ms=none total_ms=\d+ outcome=timeout$/);
  assert.match(trace[1], /^\[unvibe-review\] id=iad1::test-2 status=200 first_token_ms=\d+ total_ms=\d+ outcome=done$/);
});

test('the sample is retried only once: a second stall shows the error', async () => {
  plan = ['stall', 'stall', 'ok'];
  reviewCalls = 0;
  const { win, events } = panel();
  await runWithClock(() => runReview(win, sampleSession(), { level: 'intermediate' }), () => events.some((ev) => ev.type === 'error'));
  assert.equal(reviewCalls, 2);
  assert.deepEqual(events.filter((ev) => ev.type === 'error').map((ev) => ev.message), ['The explanation stopped responding. Check your connection and try again.']);
});
