import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, net } from './electronStub';

// Settings and the learning store live under userData; this file gets its own.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-own-code-step-'));
app.getPath = (): string => userData;

import type { BrowserWindow } from 'electron';
import type { LocalEvent } from '../src/core/learning';
import { isLoginLaunch, launchOpensWindow, LOGIN_LAUNCH_ARG } from '../src/core/loginItem';
import { deleteAccountAndLocalData } from '../src/main/accountDeletion';
import { noteCompanionOpen, ownCodeStepNotNow, ownCodeStepShown } from '../src/main/ownCodeStep';
import { runReview, type ReviewSession } from '../src/main/review';
import { settings } from '../src/main/settings';
import { store } from '../src/main/store';
import { CONSENT_ITEMS } from '../src/core/consent';
import { consentStore } from '../src/main/consentStore';

// The own-code step ends after the person's own code is explained, which needs their agreement first.
consentStore().agree([...CONSENT_ITEMS], 'unvibe');

// The explanation service streams one short explanation; anything else is not found.
net.fetch = async (input: string | URL | Request): Promise<Response> => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.pathname !== '/api/v1/reviews') return Response.json({ error: 'not_found' }, { status: 404 });
  const events = [{ type: 'token', text: 'This waits for quiet input.' }, { type: 'done', model: 'test', mock: false }];
  return new Response(events.map((ev) => `data: ${JSON.stringify(ev)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
};

const SETTINGS_FILE = path.join(userData, 'unvibe-settings.json');
const SAMPLE = 'function debounce(fn, wait) {\n  let timer;\n}';

function lesson(id: string, extra: Partial<LocalEvent> = {}): LocalEvent {
  return {
    id, ts: new Date().toISOString(), eventType: 'explanation_completed',
    scope: 'selection', level: 'intermediate', outcome: 'reviewed', lines: 3, code: 'const a = 1;', ...extra,
  };
}

/** A finished explanation through the review pipeline, which every explain path ends in. */
async function explain(code: string, sample: boolean): Promise<void> {
  const win = { isDestroyed: () => false, webContents: { send: () => undefined } } as unknown as BrowserWindow;
  const session: ReviewSession = {
    reviewId: `rv-${Math.random().toString(36).slice(2)}`, tabId: '1', code, sourceApp: sample ? 'Unvibe' : 'Cursor',
    abort: null, recorded: false, level: 'intermediate', mode: 'selection', isSample: () => sample,
  };
  await runReview(win, session, { level: 'intermediate' });
  assert.ok(store().eventById(session.reviewId), 'the explanation was saved');
}

// Setup is done and the only saved lesson is the first-run sample, next to an app-open record.
settings().set({ onboarded: true });
store().recordReview(lesson('sample-1', { sample: true, sourceApp: 'Unvibe', code: SAMPLE }));
store().recordReview(lesson('active-2026-10-25', { eventType: 'day_active', scope: 'app', lines: 0 }));

// First, while this run has had no open yet.
test('(c) a login-item start opens no window and shows nothing', () => {
  const macLogin = isLoginLaunch('darwin', ['/Applications/Unvibe.app/Contents/MacOS/Unvibe'], true);
  const winLogin = isLoginLaunch('win32', ['C:\\Unvibe\\Unvibe.exe', LOGIN_LAUNCH_ARG], false);
  assert.equal(launchOpensWindow(macLogin, settings().all().onboarded), false, 'no window on a Mac login start');
  assert.equal(launchOpensWindow(winLogin, settings().all().onboarded), false, 'no window on a Windows login start');
  assert.equal(ownCodeStepShown(), false, 'a login start is not an open, so the step is not shown');
  // The user later opens Unvibe from the menu bar or tray: that open is theirs.
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), true);
});

test('(a) sample-only history and a user-started open show the step, from the open after setup', () => {
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), true, 'sample plus an app-open record is still sample-only');
  // Setup not done: the companion shows setup instead.
  settings().set({ onboarded: false });
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), false);
  // Setup finishes in this open: its last step just asked the same thing, so not again now.
  settings().set({ onboarded: true });
  assert.equal(ownCodeStepShown(), false);
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), true, 'the next open leads with it');
});

test('(d) "Not now" hides the step until the next open only', () => {
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), true);
  ownCodeStepNotNow();
  assert.equal(ownCodeStepShown(), false, 'hidden for the rest of this open');
  assert.equal(ownCodeStepShown(), false, 'a refresh in the same open keeps it hidden');
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), true, 'back on the next open');
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), true, 'and the one after');
});

test('(b) any own-code lesson hides the step, and the first own-code explanation ends it for good', async () => {
  noteCompanionOpen();
  // The sample explained again is still the sample.
  await explain(SAMPLE, true);
  assert.equal(ownCodeStepShown(), true);
  assert.equal(settings().all().ownCodeExplained, undefined);
  // An own-code lesson synced from another computer hides it, from whichever path it came.
  for (const extra of [{ scope: 'selection', sourceApp: 'Cursor' }, { scope: 'working', file: 'src/a.ts' }]) {
    const id = `synced-${extra.scope}`;
    store().mergeRemote([lesson(id, extra)]);
    assert.equal(ownCodeStepShown(), false, `a ${extra.scope} lesson hides it`);
    store().forgetEvent(id);
    assert.equal(ownCodeStepShown(), true);
  }
  // An Ask chat is not an explanation of code.
  store().recordReview(lesson('chat-1', { scope: 'chat', concept: 'chat' }));
  assert.equal(ownCodeStepShown(), true);
  // The user's own code, explained here: gone, and it stays gone even with that lesson deleted.
  await explain('const total = items.reduce((sum, item) => sum + item.price, 0);', false);
  assert.equal(ownCodeStepShown(), false);
  assert.equal(settings().all().ownCodeExplained, true);
  for (const event of store().events()) if (!event.sample) store().forgetEvent(event.id);
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), false, 'deleted lessons do not bring it back');
  assert.equal((JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as Record<string, unknown>).ownCodeExplained, true, 'kept on disk');
});

test('(e) Erase everything removes the own-code state', async () => {
  assert.equal(settings().all().ownCodeExplained, true);
  const result = await deleteAccountAndLocalData(() => undefined);
  assert.deepEqual(result, { ok: true, status: 'erased_locally' });
  assert.equal(settings().all().ownCodeExplained, undefined);
  assert.equal('ownCodeExplained' in (JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as Record<string, unknown>), false);
  assert.deepEqual(store().events(), []);
  // In the open where the erase ran, nothing new appears.
  assert.equal(ownCodeStepShown(), false, 'not in the open that erased');
  // Nothing is left that says own code was explained, so the next open offers the step again.
  noteCompanionOpen();
  assert.equal(ownCodeStepShown(), true);
});
