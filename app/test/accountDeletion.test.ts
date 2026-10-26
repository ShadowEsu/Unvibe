import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, safeStorage } from './electronStub';

// Everything under userData belongs to this file only. The keychain stand-in "works" so a session and
// an API key can be saved the way they are on a real computer.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-account-deletion-'));
app.getPath = (): string => userData;
safeStorage.isEncryptionAvailable = (): boolean => true;

import { deleteAccountAndLocalData } from '../src/main/accountDeletion';
import { hasAiKey, writeAiKey } from '../src/main/aiKey';
import { knowledgeStore } from '../src/main/knowledgeStore';
import { settings } from '../src/main/settings';
import { store } from '../src/main/store';
import { clearReviewChecklists, reviewChecklistKey } from '../src/core/reviewChecklist';

const KEY_FILE = path.join(userData, 'unvibe-ai-key.bin');
const SETTINGS_FILE = path.join(userData, 'unvibe-settings.json');

/** The service's answer to DELETE /api/v1/account, or a thrown network failure. */
type Answer = { status: number; body: unknown } | 'network-down';

function serviceAnswers(answer: Answer): { deletes: () => number; restore: () => void } {
  const original = globalThis.fetch;
  let deletes = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    assert.match(url, /\/api\/v1\/account$/);
    assert.equal(init?.method, 'DELETE');
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer session-token');
    deletes += 1;
    if (answer === 'network-down') throw new TypeError('fetch failed');
    return Response.json(answer.body, { status: answer.status });
  }) as typeof fetch;
  return { deletes: () => deletes, restore: () => { globalThis.fetch = original; } };
}

/** A signed-in computer with learning, knowledge, a saved API key and personal settings. Starts clean. */
function signedInWithData(): void {
  store().wipeEverything();
  knowledgeStore().wipe();
  store().setAccount('user-1', 'person@example.com', 'session-token');
  store().recordReview({
    id: 'lesson-1',
    ts: new Date().toISOString(),
    eventType: 'explanation_completed',
    localDate: new Date().toISOString().slice(0, 10),
    timezone: 'UTC',
    scope: 'selection',
    level: 'beginner',
    outcome: 'reviewed',
    lines: 1,
    code: 'const total = a + b;',
    explanation: 'Adds two numbers.',
  });
  knowledgeStore().recordTeachBack({
    concept: 'addition', question: 'What does it add?', answer: 'a and b', evidence: 'THIN', checks: [], codeVersion: 'v1',
  });
  writeAiKey('provider-key-for-tests');
  settings().set({
    displayName: 'Sample Person',
    profileEmail: 'person@example.com',
    lastProjectRoot: path.join(userData, 'project'),
    giftCode: 'GIFT1234',
    useOwnAi: true,
    theme: 'dark',
    shortcut: 'Control+Alt+K',
    soundEffects: false,
  });
}

function assertNothingCleared(): void {
  assert.equal(store().token(), 'session-token', 'the session stays so the deletion can be retried');
  assert.equal(store().events().length, 1);
  assert.equal(knowledgeStore().teachBacks().length, 1);
  assert.ok(existsSync(KEY_FILE), 'the saved API key file stays');
  const s = settings().all();
  assert.equal(s.displayName, 'Sample Person');
  assert.equal(s.profileEmail, 'person@example.com');
  assert.equal(s.lastProjectRoot, path.join(userData, 'project'));
  assert.equal(s.useOwnAi, true);
}

function assertClearedAndPreferencesKept(): void {
  assert.equal(store().token(), null);
  assert.equal(store().account(), null);
  assert.deepEqual(store().events(), []);
  assert.deepEqual(knowledgeStore().teachBacks(), []);
  assert.equal(existsSync(KEY_FILE), false, 'the saved API key file is removed');
  assert.equal(hasAiKey(), false);
  const s = settings().all();
  assert.equal(s.displayName, '');
  assert.equal(s.profileEmail, '');
  assert.equal(s.lastProjectRoot, undefined);
  assert.equal(s.giftCode, '');
  assert.equal(s.useOwnAi, false);
  const onDisk = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as Record<string, unknown>;
  assert.equal(onDisk.displayName, '');
  assert.equal(onDisk.profileEmail, '');
  assert.equal('lastProjectRoot' in onDisk, false);
  // App preferences are not personal and stay.
  assert.equal(s.theme, 'dark');
  assert.equal(s.shortcut, 'Control+Alt+K');
  assert.equal(s.soundEffects, false);
}

async function deleteWith(answer: Answer) {
  signedInWithData();
  const service = serviceAnswers(answer);
  try {
    const result = await deleteAccountAndLocalData();
    assert.equal(service.deletes(), 1);
    return result;
  } finally {
    service.restore();
  }
}

test('200 deleted clears the account data on this computer and keeps app preferences', async () => {
  const result = await deleteWith({ status: 200, body: { ok: true, status: 'deleted' } });
  assert.deepEqual(result, { ok: true, status: 'deleted' });
  assertClearedAndPreferencesKept();
});

test('200 already_deleted (a lost earlier answer) is success and clears the same data', async () => {
  const result = await deleteWith({ status: 200, body: { ok: true, status: 'already_deleted' } });
  assert.deepEqual(result, { ok: true, status: 'already_deleted' });
  assertClearedAndPreferencesKept();
});

test('an older service\'s 200 { ok: true } without a status counts as deleted', async () => {
  const result = await deleteWith({ status: 200, body: { ok: true } });
  assert.deepEqual(result, { ok: true, status: 'deleted' });
  assertClearedAndPreferencesKept();
});

test('409 active_subscription shows the service\'s message and clears nothing', async () => {
  const message = 'Cancel the active subscription in Manage billing before deleting this account.';
  const result = await deleteWith({ status: 409, body: { error: 'active_subscription', message } });
  assert.deepEqual(result, { ok: false, error: message });
  assertNothingCleared();
});

test('409 team_has_members shows the service\'s message and clears nothing', async () => {
  const message = 'Other people still use your team. Remove them or hand the team over first.';
  const result = await deleteWith({ status: 409, body: { error: 'team_has_members', message } });
  assert.deepEqual(result, { ok: false, error: message });
  assertNothingCleared();
});

test('503 billing_unavailable shows the service\'s message and clears nothing', async () => {
  const message = 'We could not check your subscription. Nothing was deleted. Try again in a minute.';
  const result = await deleteWith({ status: 503, body: { error: 'billing_unavailable', message } });
  assert.deepEqual(result, { ok: false, error: message });
  assertNothingCleared();
});

test('503 deletion_unavailable without a message says nothing was deleted and clears nothing', async () => {
  const result = await deleteWith({ status: 503, body: { error: 'deletion_unavailable' } });
  assert.deepEqual(result, { ok: false, error: 'Nothing was deleted. Try again in a minute.' });
  assertNothingCleared();
});

test('a network failure says nothing was deleted and clears nothing', async () => {
  const result = await deleteWith('network-down');
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : '', /Nothing was deleted on this computer\. Try again in a minute\./);
  assertNothingCleared();
});

test('a 200 with an unknown status is not treated as deleted', async () => {
  const result = await deleteWith({ status: 200, body: { ok: true, status: 'queued' } });
  assert.equal(result.ok, false);
  assertNothingCleared();
});

test('after-agent review checklists are removed and other renderer keys stay', () => {
  const items = new Map<string, string>([
    [reviewChecklistKey('my-repo', 'Auth change'), '[0,1]'],
    [reviewChecklistKey('other-repo', 'Billing'), '[2]'],
    ['unvibe.panelTheme2', 'dark'],
    ['unvibe.feedbackAsked', '1'],
  ]);
  const storage = {
    get length() { return items.size; },
    key: (i: number) => [...items.keys()][i] ?? null,
    removeItem: (key: string) => { items.delete(key); },
  };
  clearReviewChecklists(storage);
  assert.deepEqual([...items.keys()], ['unvibe.panelTheme2', 'unvibe.feedbackAsked']);
});
