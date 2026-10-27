import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, net, safeStorage } from './electronStub';

// The store and settings live under userData; give this file its own so nothing else is touched.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-unlimited-'));
app.getPath = (): string => userData;
// Signing in seals the session token; the stub's storage stands in for the keychain.
safeStorage.isEncryptionAvailable = (): boolean => true;

import type { BrowserWindow } from 'electron';
import { runReview, type ReviewSession } from '../src/main/review';
import { askChat } from '../src/main/studyQuiz';
import { cachedAppUsage, invalidateAppUsage } from '../src/main/usage';
import { store } from '../src/main/store';

const RESETS = '2026-11-01T00:00:00.000Z';
/** A Big Business member far past any old monthly number: the line has no cap at all. */
const unlimitedLine = { kind: 'ai_explanation', used: 1_000_000, limit: null, remaining: null, resetsAt: RESETS };
const RATE_LIMITED = 'You\'ve reached the fair-use rate limit against automated abuse (per person, 10 requests a minute, 60 an hour and 1 million characters an hour). Try again in 2 minutes.';

/** When set, the explanation service refuses with this response instead of explaining. */
let reviewRefusal: { status: number; body: Record<string, unknown>; headers?: Record<string, string> } | null = null;

net.fetch = async (input: string | URL | Request): Promise<Response> => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.pathname === '/api/v1/billing/overview') {
    return Response.json({
      overview: {
        workspace: { id: 'ws-1', name: 'Team', type: 'team', role: 'member' },
        subscription: { plan: 'business', interval: 'lifetime', status: 'active', seats: 10, cancelAtPeriodEnd: false },
        usage: [unlimitedLine, { ...unlimitedLine, kind: 'project_question' }],
        occupiedSeats: 3,
        pendingInvitations: 0,
        minimumBillableSeats: 1,
        canManageBilling: false,
        hasBillingAccount: true,
      },
      checkoutAvailable: false,
    });
  }
  if (url.pathname === '/api/v1/reviews') {
    if (reviewRefusal) return Response.json(reviewRefusal.body, { status: reviewRefusal.status, headers: reviewRefusal.headers });
    const events = [{ type: 'token', text: 'EXPLANATION of a debounce helper.' }, { type: 'done', model: 'test', mock: false }];
    return new Response(events.map((ev) => `data: ${JSON.stringify(ev)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
  }
  return Response.json({ error: 'not_found' }, { status: 404 });
};

store().setAccount('member-1', 'member@example.com', 'session-token');

/** A panel stand-in with only webContents.send: raising the limit pause on it would throw, and that error would show. */
function panel(): { win: BrowserWindow; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const win = { isDestroyed: () => false, webContents: { send: (_channel: string, ev: Record<string, unknown>) => events.push(ev) } } as unknown as BrowserWindow;
  return { win, events };
}

function session(): ReviewSession {
  return {
    reviewId: `rv-${Math.random().toString(36).slice(2)}`,
    tabId: '1',
    code: 'function debounce(fn, wait) {\n  let timer;\n  return () => { clearTimeout(timer); timer = setTimeout(fn, wait); };\n}',
    sourceApp: 'Terminal',
    abort: null,
    recorded: false,
    level: 'intermediate',
    mode: 'selection',
  };
}

test('an unlimited usage line maps to null limit and remaining, never 0', async () => {
  invalidateAppUsage();
  const usage = await cachedAppUsage();
  assert.equal(usage.plan, 'business');
  assert.equal(usage.used, 1_000_000);
  assert.equal(usage.limit, null);
  assert.equal(usage.remaining, null);
});

test('an unlimited allowance used 1,000,000 times still explains: no limit error, no pause, no "0 left"', async () => {
  invalidateAppUsage();
  const { win, events } = panel();
  await runReview(win, session(), { level: 'intermediate' });
  assert.deepEqual(events.filter((ev) => ev.type === 'error'), []);
  assert.ok(events.some((ev) => ev.type === 'done'), 'the explanation finished');
  const usage = events.filter((ev) => ev.type === 'usage');
  assert.ok(usage.length > 0);
  for (const ev of usage) {
    assert.equal(ev.limit, null);
    assert.equal(ev.remaining, null);
  }
});

test('unlimited Chat answers and reports remaining as unlimited (null), not 0', async () => {
  invalidateAppUsage();
  const result = await askChat({ question: 'What does a debounce helper do?' });
  assert.equal(result.ok, true);
  assert.equal(result.remaining, null);
});

test('a 429 fair_use_rate_limited shows the server\'s message with no Plan page, limit pause or upgrade', async () => {
  invalidateAppUsage();
  const { win, events } = panel();
  reviewRefusal = { status: 429, body: { error: 'fair_use_rate_limited', message: RATE_LIMITED, retryAfterSeconds: 120 }, headers: { 'retry-after': '120' } };
  try {
    await runReview(win, session(), { level: 'intermediate' });
    const errors = events.filter((ev) => ev.type === 'error');
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.message, RATE_LIMITED);
    assert.equal(errors[0]?.code, undefined);
    assert.equal(errors[0]?.upgradePath, undefined);

    const chat = await askChat({ question: 'What does a debounce helper do?' });
    assert.equal(chat.ok, false);
    if (!chat.ok) {
      assert.equal(chat.error, RATE_LIMITED);
      assert.notEqual(chat.remaining, 0);
    }
  } finally {
    reviewRefusal = null;
  }
});
