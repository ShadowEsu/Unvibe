import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, net } from './electronStub';

const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-panel-errors-'));
app.getPath = (): string => userData;

import type { BrowserWindow } from 'electron';
import { FIRST_RUN_SAMPLE } from '../src/core/consent';
import { runReview } from '../src/main/review';
import { actionRow, errorView, statusLabel, type Phase } from '../src/renderer/widget/panelModel';

/** No request reaches a server; `online` is what the operating system says about the network. */
let online = false;
net.fetch = async (): Promise<Response> => { throw new TypeError('fetch failed'); };
net.isOnline = () => online;
globalThis.fetch = (async () => { throw new Error('Network is disabled in tests.'); }) as typeof fetch;

async function failedRun(): Promise<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  const win = { isDestroyed: () => false, webContents: { send: (_c: string, ev: Record<string, unknown>) => events.push(ev) } } as unknown as BrowserWindow;
  await runReview(win, {
    reviewId: `rv-${Math.random().toString(36).slice(2)}`, tabId: '1', code: FIRST_RUN_SAMPLE, sourceApp: 'Unvibe',
    abort: null, recorded: false, level: 'intermediate', mode: 'selection', isSample: () => true,
  }, { level: 'intermediate' });
  const error = events.find((ev) => ev.type === 'error');
  assert.ok(error, 'the panel hears about the failure');
  return error;
}

test('a request that never reaches the server tells the panel whether this computer is offline', async () => {
  const realLog = console.log;
  console.log = () => {};
  try {
    online = false;
    assert.equal((await failedRun()).code, 'offline');
    online = true;
    assert.equal((await failedRun()).code, 'unreachable', 'online, but the server did not answer');
  } finally {
    console.log = realLog;
  }
});

test('offline is told apart from other errors: its own explanation and Retry; other errors keep the service message', () => {
  const offline = errorView('offline', 'You appear to be offline. Reconnect to the internet and try again.');
  const unreachable = errorView('unreachable', 'Unvibe could not reach its explanation service.');
  const service = errorView('', 'The explanation service is busy. Try again in a moment.');
  assert.equal(offline.action, 'Retry');
  assert.equal(unreachable.action, 'Retry');
  assert.equal(service.action, 'Try again');
  assert.equal(service.body, 'The explanation service is busy. Try again in a moment.', 'the service message is shown as sent');
  assert.notEqual(offline.title, service.title, 'offline does not read like any other error');
  assert.notEqual(offline.title, unreachable.title, 'offline is only claimed when the network is down');
});

test('the header status reads Offline for a network failure and Paused at the limit, and the error frame keeps its rows', () => {
  for (const code of ['offline', 'unreachable']) {
    assert.equal(statusLabel('error', { limited: false, errorCode: code, proGate: false }), 'Offline');
  }
  assert.notEqual(statusLabel('error', { limited: false, errorCode: '', proGate: false }), 'Offline');
  assert.equal(statusLabel('boot', { limited: true, errorCode: '', proGate: false }), 'Paused');
  assert.equal(statusLabel('error', { limited: true, errorCode: 'plan_limit_reached', proGate: false }), 'Paused');
  assert.equal(statusLabel('streaming', { limited: false, errorCode: '', proGate: false }), 'Explaining');
  assert.equal(statusLabel('done', { limited: false, errorCode: '', proGate: false }), 'Ready');
  assert.ok(actionRow('error', false, false), 'the action row stays in error and offline states');
});

test('every header status is in sentence case', () => {
  const phases: Phase[] = ['boot', 'ready', 'aiConsent', 'confirm', 'empty', 'consent', 'blocked', 'streaming', 'done', 'error'];
  for (const phase of phases) {
    for (const errorCode of ['', 'offline']) {
      for (const proGate of [false, true]) {
        const label = statusLabel(phase, { limited: false, errorCode, proGate });
        assert.match(label, /^[A-Z][a-z]*( [a-z]+)*$/, `${phase}: "${label}"`);
      }
    }
  }
});
