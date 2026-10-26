import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, safeStorage, sessionCalls } from './electronStub';

// Everything under userData belongs to this file only. The keychain stand-in "works" so a session and
// an API key can be saved the way they are on a real computer.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-account-deletion-'));
app.getPath = (): string => userData;
safeStorage.isEncryptionAvailable = (): boolean => true;

import { deleteAccountAndLocalData, UNREADABLE_SIGN_IN } from '../src/main/accountDeletion';
import { hasAiKey, writeAiKey } from '../src/main/aiKey';
import { knowledgeStore } from '../src/main/knowledgeStore';
import { settings } from '../src/main/settings';
import { store } from '../src/main/store';
import { flush } from '../src/main/sync';
import { askChat, askStudyAssistant } from '../src/main/studyQuiz';
import type { LocalEvent } from '../src/core/learning';

const KEY_FILE = path.join(userData, 'unvibe-ai-key.bin');
const SETTINGS_FILE = path.join(userData, 'unvibe-settings.json');
const STORE_FILE = path.join(userData, 'unvibe-store.json');
const KNOWLEDGE_FILE = path.join(userData, 'unvibe-knowledge.json');

/** Puts a non-empty directory where `file` goes, so writing it fails the way a full or locked disk does. */
function blockFile(file: string): void {
  rmSync(file, { recursive: true, force: true });
  mkdirSync(file);
  writeFileSync(path.join(file, 'blocker'), 'x');
}

/** The service's answer to DELETE /api/v1/account (JSON or plain text), or a thrown network failure. */
type Answer = { status: number; body: unknown } | { status: number; text: string } | 'network-down';

function serviceAnswers(answer: Answer): { deletes: () => number; redirects: () => unknown[]; restore: () => void } {
  const original = globalThis.fetch;
  const redirects: unknown[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    assert.match(url, /\/api\/v1\/account$/);
    assert.equal(init?.method, 'DELETE');
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer session-token');
    redirects.push(init?.redirect);
    if (answer === 'network-down') throw new TypeError('fetch failed');
    if ('text' in answer) return new Response(answer.text, { status: answer.status, headers: { 'content-type': 'text/html' } });
    return Response.json(answer.body, { status: answer.status });
  }) as typeof fetch;
  return { deletes: () => redirects.length, redirects: () => redirects, restore: () => { globalThis.fetch = original; } };
}

/** The main process closes the review panel here; these tests have none. */
const stopReviews = (): void => undefined;

function lesson(id: string): LocalEvent {
  return {
    id,
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
  };
}

/** A signed-in computer with learning, knowledge, a saved API key and personal settings. Starts clean. */
function signedInWithData(): void {
  store().wipeEverything();
  knowledgeStore().wipe();
  store().setAccount('user-1', 'person@example.com', 'session-token');
  store().recordReview(lesson('lesson-1'));
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
  sessionCalls.length = 0;
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
  assert.deepEqual(sessionCalls, [], 'renderer storage and the HTTP cache stay');
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
  // Renderer web storage (checklists keyed by repository name) and the HTTP cache go through the
  // session, which also removes what localStorage.removeItem would leave in LevelDB.
  assert.deepEqual(sessionCalls, [
    { call: 'clearStorageData', options: { storages: ['localstorage', 'indexdb', 'websql', 'filesystem', 'cookies', 'cachestorage', 'serviceworkers'] } },
    { call: 'clearCache' },
  ]);
}

async function deleteWith(answer: Answer) {
  signedInWithData();
  const service = serviceAnswers(answer);
  try {
    const result = await deleteAccountAndLocalData(stopReviews);
    assert.equal(service.deletes(), 1);
    assert.deepEqual(service.redirects(), ['error'], 'a redirect is refused, so only the configured service can answer');
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

const PENDING_NOTE = 'Your account and app data are deleted. We could not check for beta-download records just now; any we find, and the email address kept to find them, will be removed within 30 days.';

test('200 deleted with a message passes the message on to show, and still clears everything', async () => {
  const result = await deleteWith({ status: 200, body: { ok: true, status: 'deleted', message: PENDING_NOTE } });
  assert.deepEqual(result, { ok: true, status: 'deleted', message: PENDING_NOTE });
  assertClearedAndPreferencesKept();
});

test('200 already_deleted with a message passes it on too', async () => {
  const result = await deleteWith({ status: 200, body: { ok: true, status: 'already_deleted', message: `  ${PENDING_NOTE}  ` } });
  assert.deepEqual(result, { ok: true, status: 'already_deleted', message: PENDING_NOTE });
  assertClearedAndPreferencesKept();
});

test('a success message is cut to 300 characters; an empty or non-string one is left out', async () => {
  const long = await deleteWith({ status: 200, body: { ok: true, status: 'deleted', message: 'y'.repeat(1_000) } });
  assert.deepEqual(long, { ok: true, status: 'deleted', message: 'y'.repeat(300) });
  const blank = await deleteWith({ status: 200, body: { ok: true, status: 'deleted', message: '   ' } });
  assert.deepEqual(blank, { ok: true, status: 'deleted' });
  const notText = await deleteWith({ status: 200, body: { ok: true, status: 'deleted', message: { html: '<b>x</b>' } } });
  assert.deepEqual(notText, { ok: true, status: 'deleted' });
  assertClearedAndPreferencesKept();
});

test('a message does not make another status count as deleted', async () => {
  const result = await deleteWith({ status: 200, body: { ok: true, status: 'cleanup_pending', message: PENDING_NOTE } });
  assert.equal(result.ok, false);
  assertNothingCleared();
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

test('only a 200 counts: a 202 with a deleted status clears nothing', async () => {
  const result = await deleteWith({ status: 202, body: { ok: true, status: 'deleted' } });
  assert.equal(result.ok, false);
  assertNothingCleared();
});

test('a long refusal message is cut to 300 characters', async () => {
  const result = await deleteWith({ status: 409, body: { error: 'team_has_members', message: 'x'.repeat(1_000) } });
  assert.deepEqual(result, { ok: false, error: 'x'.repeat(300) });
  assertNothingCleared();
});

test('402 and 429 messages are cut to 300 characters too, and a missing one gets the plan text', async () => {
  for (const status of [402, 429]) {
    const long = await deleteWith({ status, body: { error: 'plan_limit_reached', message: 'z'.repeat(1_000) } });
    assert.deepEqual(long, { ok: false, error: 'z'.repeat(300) }, `${status} message capped`);
    assertNothingCleared();
    const bare = await deleteWith({ status, body: {} });
    assert.deepEqual(bare, { ok: false, error: 'Your plan limit has been reached. Open Plan & usage to review options.' });
    assertNothingCleared();
  }
});

const NOT_DELETED: Array<[string, Answer]> = [
  ['401 (the service no longer knows the session)', { status: 401, body: { error: 'unauthorized' } }],
  ['500 with { ok: true }', { status: 500, body: { ok: true } }],
  ['200 {}', { status: 200, body: {} }],
  ['200 { ok: false }', { status: 200, body: { ok: false } }],
  ['200 with a text body', { status: 200, text: '<html><body>Welcome</body></html>' }],
];

for (const [name, answer] of NOT_DELETED) {
  test(`${name} clears nothing`, async () => {
    const result = await deleteWith(answer);
    assert.equal(result.ok, false);
    assertNothingCleared();
  });
}

/** One deletion attempt against `answer`, with the network stand-in removed afterwards. */
async function attempt(answer: Answer) {
  const service = serviceAnswers(answer);
  try {
    return await deleteAccountAndLocalData(stopReviews);
  } finally {
    service.restore();
  }
}

test('a key file that can\'t be removed stops the cleanup with the session kept, and a retry finishes it', async () => {
  signedInWithData();
  blockFile(KEY_FILE); // a non-empty directory where the API key file goes can't be unlinked
  try {
    const first = await attempt({ status: 200, body: { ok: true, status: 'deleted' } });
    assert.deepEqual(first, {
      ok: false,
      error: 'Your account was deleted, but some data on this computer could not be removed. The API key saved in Unvibe could not be removed. Try again to finish.',
    });
    assert.equal(store().token(), 'session-token', 'the session stays for the retry');
    assert.equal(store().events().length, 1);
    assert.equal(settings().all().displayName, 'Sample Person');

    rmSync(KEY_FILE, { recursive: true, force: true });
    const retry = await attempt({ status: 200, body: { ok: true, status: 'already_deleted' } });
    assert.deepEqual(retry, { ok: true, status: 'already_deleted' });
    assertClearedAndPreferencesKept();
  } finally {
    rmSync(KEY_FILE, { recursive: true, force: true });
  }
});

test('a clear that can\'t be saved throws and leaves memory matching what is on disk', () => {
  signedInWithData();
  const files = [STORE_FILE, KNOWLEDGE_FILE, SETTINGS_FILE];
  for (const file of files) blockFile(file);
  try {
    assert.throws(() => store().wipeEverything());
    assert.throws(() => knowledgeStore().wipe());
    assert.throws(() => settings().forgetPerson());
    assertNothingCleared();
  } finally {
    for (const file of files) rmSync(file, { recursive: true, force: true });
  }
});

test('an account whose sign-in can\'t be decrypted sends no request, clears nothing and says to sign in again', async () => {
  signedInWithData();
  const service = serviceAnswers({ status: 200, body: { ok: true, status: 'deleted' } });
  const decrypt = safeStorage.decryptString;
  safeStorage.decryptString = (): string => { throw new Error('keychain locked'); };
  let result;
  try {
    assert.equal(store().token(), null);
    assert.ok(store().account(), 'the account is still shown, so the panel offers Delete');
    result = await deleteAccountAndLocalData(stopReviews);
  } finally {
    safeStorage.decryptString = decrypt;
    service.restore();
  }
  assert.equal(service.deletes(), 0, 'no DELETE is sent');
  assert.deepEqual(result, { ok: false, error: UNREADABLE_SIGN_IN });
  assertNothingCleared();
});

test('with no account at all, Erase everything clears the learning without asking the service', async () => {
  signedInWithData();
  store().signOut();
  const service = serviceAnswers({ status: 200, body: { ok: true, status: 'deleted' } });
  let result;
  try {
    result = await deleteAccountAndLocalData(stopReviews);
  } finally {
    service.restore();
  }
  assert.equal(service.deletes(), 0);
  assert.deepEqual(result, { ok: true, status: 'erased_locally' });
  assert.deepEqual(store().events(), []);
  assert.deepEqual(knowledgeStore().teachBacks(), []);
});

/**
 * Answers the sync routes and DELETE. GET /history (the pull) waits for `release`; with `honourAbort`
 * it ends when its request is aborted, the way a real network request does.
 */
function syncService(honourAbort: boolean) {
  const original = globalThis.fetch;
  let pullSignal: AbortSignal | undefined;
  let pullStarted!: () => void;
  const started = new Promise<void>((resolve) => { pullStarted = resolve; });
  let release!: (events: LocalEvent[]) => void;
  const answer = new Promise<LocalEvent[]>((resolve) => { release = resolve; });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method === 'DELETE') return Response.json({ ok: true, status: 'deleted' });
    if (url.includes('/api/v1/events')) return Response.json({ ok: true });
    assert.match(url, /\/api\/v1\/history/);
    pullSignal = init?.signal ?? undefined;
    pullStarted();
    const aborted = new Promise<never>((_, reject) => {
      if (honourAbort) pullSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    return Response.json({ events: await Promise.race([answer, aborted]) });
  }) as typeof fetch;
  return { started, release, pullSignal: () => pullSignal, restore: () => { release([]); globalThis.fetch = original; } };
}

// Each sync test ends its own sync in `finally`, so a failure can't leave it running into the next test.
test('deletion stops reviews and a running sync, and waits for the sync, before clearing anything', { timeout: 10_000 }, async () => {
  signedInWithData();
  const service = syncService(true);
  const syncing = flush();
  try {
    await service.started;
    let eventsWhenReviewsStopped = -1;
    const result = await deleteAccountAndLocalData(() => { eventsWhenReviewsStopped = store().events().length; });
    assert.equal(service.pullSignal()?.aborted, true, 'the running sync was aborted');
    service.release([lesson('lesson-from-server')]);
    await syncing;
    assert.deepEqual(result, { ok: true, status: 'deleted' });
    assert.equal(eventsWhenReviewsStopped, 1, 'reviews are stopped before anything is cleared');
    assertClearedAndPreferencesKept();
  } finally {
    service.restore();
    await syncing;
  }
});

test('a sync answer that arrives after the session ended is not saved', { timeout: 10_000 }, async () => {
  signedInWithData();
  const service = syncService(false);
  const syncing = flush();
  try {
    await service.started;
    store().wipeEverything(); // the session ends while the pull is still out
    service.release([lesson('lesson-from-server')]);
    await syncing;
    assert.deepEqual(store().events(), []);
  } finally {
    service.restore();
    await syncing;
  }
});

/**
 * The person's own provider (Gemini, the default) answers after `release`. With `honourAbort` the
 * request ends when aborted; without it the reply still arrives, like a provider that ignores the abort.
 * DELETE /api/v1/account answers deleted; every other request fails like an offline network.
 */
function ownKeyProvider(honourAbort: boolean) {
  const original = globalThis.fetch;
  let providerSignal: AbortSignal | undefined;
  let called!: () => void;
  const started = new Promise<void>((resolve) => { called = resolve; });
  let release!: () => void;
  const replied = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method === 'DELETE' && /\/api\/v1\/account$/.test(url)) return Response.json({ ok: true, status: 'deleted' });
    if (!url.includes('generativelanguage.googleapis.com')) throw new TypeError('fetch failed');
    providerSignal = init?.signal ?? undefined;
    called();
    const aborted = new Promise<never>((_, reject) => {
      if (honourAbort) providerSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    await Promise.race([replied, aborted]);
    return new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'A late reply.' }] } }] })}\n\n`);
  }) as typeof fetch;
  return { started, release, providerSignal: () => providerSignal, restore: () => { release(); globalThis.fetch = original; } };
}

test('a Chat reply from the person\'s own key that arrives after a wipe writes nothing', { timeout: 10_000 }, async () => {
  signedInWithData();
  const provider = ownKeyProvider(false);
  try {
    const chatting = askChat({ question: 'What does map do?' });
    await provider.started;
    store().wipeEverything();
    provider.release();
    const result = await chatting;
    assert.equal(result.ok, false);
    assert.deepEqual(store().events(), [], 'no chat lesson written into the wiped store');
  } finally {
    provider.restore();
  }
});

test('a study answer that arrives after a wipe uses no allowance and writes nothing', { timeout: 10_000 }, async () => {
  signedInWithData();
  const provider = ownKeyProvider(false);
  try {
    const asking = askStudyAssistant({ eventId: 'lesson-1', question: 'Why add them?' });
    await provider.started;
    store().wipeEverything();
    provider.release();
    const result = await asking;
    assert.equal(result.ok, false);
    assert.equal(store().studyAskUsage().used, 0, 'no daily study count written into the wiped store');
  } finally {
    provider.restore();
  }
});

test('account deletion aborts a Chat reply still streaming from the person\'s own key', { timeout: 10_000 }, async () => {
  signedInWithData();
  const provider = ownKeyProvider(true);
  try {
    const chatting = askChat({ question: 'What does map do?' });
    await provider.started;
    const deleted = await deleteAccountAndLocalData(stopReviews);
    assert.equal(provider.providerSignal()?.aborted, true, 'the provider request was aborted');
    const result = await chatting;
    assert.deepEqual(deleted, { ok: true, status: 'deleted' });
    assert.equal(result.ok, false);
    assertClearedAndPreferencesKept();
  } finally {
    provider.restore();
  }
});
