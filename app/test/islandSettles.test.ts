import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, net } from './electronStub';

// The store and settings live under userData; give this file its own so nothing else is touched.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-island-settles-'));
app.getPath = (): string => userData;

import type { BrowserWindow } from 'electron';
import { setBar, type BarPulse } from '../src/main/notify';
import { cancelReview, runReview, type ReviewSession } from '../src/main/review';
import { takeSelectionCredit } from '../src/main/selectionCredit';
import { store } from '../src/main/store';
import { CONSENT_ITEMS } from '../src/core/consent';
import { consentStore } from '../src/main/consentStore';

consentStore().agree([...CONSENT_ITEMS], 'unvibe');

/** The Island: every pulse it is sent, in order. Nothing else of the window matters here. */
const pulses: BarPulse[] = [];
const bar = new Proxy({}, {
  get: (_target, key) => {
    if (key === 'webContents') return { send: (channel: string, pulse: BarPulse) => { if (channel === 'bar:pulse') pulses.push(pulse); } };
    if (key === 'isDestroyed') return () => false;
    if (key === 'isVisible') return () => true;
    if (key === 'getBounds') return () => ({ x: 0, y: 0, width: 184, height: 38 });
    return () => undefined;
  },
}) as BrowserWindow;
setBar(bar);
const lastPulse = () => pulses.at(-1);

/** When set, the explanation request is out and waits here until it is aborted. */
let requestOut: (() => void) | null = null;
net.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.pathname === '/api/v1/reviews') {
    requestOut?.();
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  }
  return Response.json({ error: 'not_found' }, { status: 404 });
};

function panel(): { win: BrowserWindow; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const win = { isDestroyed: () => false, webContents: { send: (_channel: string, ev: Record<string, unknown>) => events.push(ev) } } as unknown as BrowserWindow;
  return { win, events };
}

test('Cancel while the explanation is being written: the panel is told and the Island leaves its working word for Ready', async () => {
  const { win, events } = panel();
  const session: ReviewSession = {
    reviewId: 'rv-cancel',
    code: 'function debounce(fn, wait) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}',
    sourceApp: 'Terminal',
    abort: null,
    recorded: false,
    level: 'intermediate',
    mode: 'selection',
  };
  const out = new Promise<void>((resolve) => { requestOut = resolve; });
  const run = runReview(win, session, { level: 'intermediate' });
  await out;
  assert.equal(lastPulse()?.phase, 'thinking', 'the Island is on a working word while the request is out');
  cancelReview(win, session);
  await run;
  requestOut = null;
  assert.deepEqual(lastPulse(), { phase: 'idle', label: 'Ready' });
  assert.equal(events.at(-1)?.type, 'cancelled');
});

test('a trial build with its selected-code prompts used up: no credit, a notice, and the Island gets the limit\'s error pulse (shown as Issue) instead of staying on Loading', () => {
  assert.equal(takeSelectionCredit(false), 'free', 'a build that does not count them always has one');
  const before = pulses.length;
  while (store().betaSelectedCodeUsage().remaining > 0) assert.equal(takeSelectionCredit(true), 'held');
  assert.equal(pulses.length, before, 'a credit taken leaves the Island alone');
  assert.equal(takeSelectionCredit(true), null);
  assert.deepEqual(lastPulse(), { phase: 'error', label: 'Limit reached' });
});
