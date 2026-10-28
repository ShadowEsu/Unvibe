import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, net, netCalls, safeStorage } from './electronStub';

// The consent record, settings and key live under userData; this file gets its own, starting empty.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-consent-'));
app.getPath = (): string => userData;
// The keychain stand-in "works", so an own API key can be saved.
safeStorage.isEncryptionAvailable = (): boolean => true;

import type { BrowserWindow } from 'electron';
import {
  agreedItems,
  aiSendAllowed,
  CONSENT_COPY,
  CONSENT_ITEMS,
  ConsentRequiredError,
  FIRST_RUN_SAMPLE,
  isFirstRunSamplePayload,
  POLICY_VERSION,
  type ConsentRecord,
} from '../src/core/consent';
import type { ReviewRequestPayload } from '../src/core/protocol';
import { fetchQuestion, postReview } from '../src/main/backend';
import { streamLocalAi } from '../src/main/localAi';
import { consentStore, sendingSwitchedOff } from '../src/main/consentStore';
import { consentStatus, providerInUse } from '../src/main/consent';
import { askChat } from '../src/main/studyQuiz';
import { initWidget, runReview, type ReviewSession } from '../src/main/review';
import { settings } from '../src/main/settings';
import { clearAiKey, writeAiKey } from '../src/main/aiKey';
import { shortcutKeys } from '../src/core/shortcutKeys';

/** Every request that left, by URL: Electron's net and Node's fetch (own-key providers use fetch). */
const sent: string[] = [];
net.fetch = async (input: string | URL | Request): Promise<Response> => {
  const url = String(input instanceof Request ? input.url : input);
  sent.push(url);
  netCalls.push(url);
  if (url.endsWith('/api/v1/usage') || url.includes('/usage')) {
    return Response.json({ used: 0, limit: 50, remaining: 50, resetsAt: '2026-11-28T00:00:00Z', plan: 'trial' });
  }
  return new Response('data: {"type":"token","text":"ok"}\n\ndata: {"type":"done","model":"test","mock":false}\n\n', { headers: { 'content-type': 'text/event-stream' } });
};
globalThis.fetch = (async (input: string | URL | Request) => {
  sent.push(String(input instanceof Request ? input.url : input));
  throw new Error('Network is disabled in tests.');
}) as typeof fetch;

const contentSent = () => sent.filter((url) => !url.includes('/usage'));

function payload(code: string, extra: Partial<ReviewRequestPayload> = {}): ReviewRequestPayload {
  return { scope: 'selection', level: 'intermediate', context: { language: 'javascript', projectStructure: [], imports: [], code }, ...extra };
}

function panel(): { win: BrowserWindow; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const win = { isDestroyed: () => false, webContents: { send: (_channel: string, ev: Record<string, unknown>) => events.push(ev) } } as unknown as BrowserWindow;
  return { win, events };
}

function ownCode(): ReviewSession {
  return { reviewId: `rv-${Math.random().toString(36).slice(2)}`, tabId: '1', code: 'const total = items.reduce((a, b) => a + b, 0);', sourceApp: 'Code', abort: null, recorded: false, level: 'intermediate', mode: 'selection' };
}

async function refused(run: () => Promise<unknown>, provider: string): Promise<void> {
  await assert.rejects(run, (error: unknown) => error instanceof ConsentRequiredError && error.provider === provider);
}

const form = { aiSend: true, terms: true, age18: true };

test('CC-3: the consent screen words are pinned to the policy version', () => {
  // Changing any word of CONSENT_COPY must come with a new POLICY_VERSION (everyone is asked again).
  const pinned: Record<string, string> = { '2026-10-28': 'efd06d3f9be7ce6c' };
  const hash = createHash('sha256').update(JSON.stringify(CONSENT_COPY)).digest('hex').slice(0, 16);
  assert.equal(hash, pinned[POLICY_VERSION], `CONSENT_COPY changed: bump POLICY_VERSION and pin ${hash}`);
});

test('the form counts only three boxes that are exactly true, for a provider Unvibe knows', () => {
  assert.deepEqual(agreedItems({ ...form, provider: 'unvibe' }), { items: [...CONSENT_ITEMS], provider: 'unvibe' });
  assert.equal(agreedItems({ ...form, age18: 'true', provider: 'unvibe' }), null);
  assert.equal(agreedItems({ aiSend: true, terms: true, provider: 'unvibe' }), null);
  assert.equal(agreedItems({ ...form, age18: 1, provider: 'unvibe' }), null);
  assert.equal(agreedItems({ ...form }), null, 'no provider named');
  assert.equal(agreedItems({ ...form, provider: 'openrouter' }), null, 'a provider Unvibe never sends to');
  assert.equal(agreedItems({ ...form, provider: 'toString' }), null);
});

test('an agreement covers one provider, this policy, until it is withdrawn', () => {
  const at = '2026-10-28T08:00:00.000Z';
  const gemini: ConsentRecord = { items: [...CONSENT_ITEMS], provider: 'unvibe', policyVersion: POLICY_VERSION, agreedAt: at };
  assert.equal(aiSendAllowed([gemini], 'unvibe'), true);
  assert.equal(aiSendAllowed([gemini], 'anthropic'), false, 'another provider needs its own agreement');
  assert.equal(aiSendAllowed([gemini], 'unvibe', '2099-01-01'), false, 'a new policy version asks again');
  assert.equal(aiSendAllowed([{ ...gemini, revokedAt: at }], 'unvibe'), false);
  assert.equal(aiSendAllowed([{ ...gemini, items: ['ai_send', 'terms'] }], 'unvibe'), false, 'no 18+ box, no agreement');
  assert.equal(aiSendAllowed([{ ...gemini, revokedAt: at }, gemini], 'unvibe'), true, 'the newest record for the provider counts');
});

test('CC-6: only the verbatim built-in sample, with nothing added, is exempt', () => {
  assert.equal(isFirstRunSamplePayload(payload(FIRST_RUN_SAMPLE)), true);
  assert.equal(isFirstRunSamplePayload(payload(FIRST_RUN_SAMPLE.replace('wait);', 'wait );'))), false, 'an edited sample');
  assert.equal(isFirstRunSamplePayload(payload(FIRST_RUN_SAMPLE, { question: 'what is my api key?' })), false, 'a typed question');
  assert.equal(isFirstRunSamplePayload(payload(FIRST_RUN_SAMPLE, { context: { language: 'javascript', projectStructure: ['client-repo'], imports: [], code: FIRST_RUN_SAMPLE } })), false, 'a project name');
  assert.equal(isFirstRunSamplePayload(payload(FIRST_RUN_SAMPLE, { context: { language: 'javascript', projectStructure: [], imports: ['nearby:src/secret.ts'], code: FIRST_RUN_SAMPLE, enclosing: 'x' } })), false, 'nearby files');
});

test('CC-1: with no agreement, every sender refuses before any request leaves', async () => {
  sent.length = 0;
  const signal = new AbortController().signal;
  await refused(() => postReview(payload('const secretPlan = 1;'), null, signal), 'unvibe');
  await refused(() => fetchQuestion(payload('const secretPlan = 1;')), 'unvibe');
  for (const provider of ['gemini', 'anthropic', 'openai', 'grok', 'deepseek', 'kimi']) {
    await refused(() => streamLocalAi({ provider, apiKey: 'test-key', system: 's', user: 'const secretPlan = 1;', onToken: () => undefined }), provider);
  }
  assert.deepEqual(sent, []);
});

test('the verbatim sample still goes to Unvibe with no agreement', async () => {
  sent.length = 0;
  const res = await postReview(payload(FIRST_RUN_SAMPLE), null, new AbortController().signal);
  await res.body?.cancel();
  assert.equal(contentSent().filter((url) => url.endsWith('/api/v1/reviews')).length, 1);
  sent.length = 0;
  await refused(() => postReview(payload(FIRST_RUN_SAMPLE, { question: 'and this?' }), null, new AbortController().signal), 'unvibe');
  assert.deepEqual(sent, [], 'a question about the sample is the person\'s own words');
});

test('the panel asks first: own code opens on the agreement and sends nothing', async () => {
  sent.length = 0;
  const { win, events } = panel();
  const s = ownCode();
  initWidget(win, s, { autoStart: true });
  const init = events.find((ev) => ev.type === 'init');
  assert.equal(init?.consentProvider, 'unvibe');
  assert.equal(init?.autoStart, false);
  await runReview(win, s, { level: 'intermediate' });
  assert.deepEqual(events.filter((ev) => ev.type === 'consentNeeded').map((ev) => ev.provider), ['unvibe']);
  assert.deepEqual(contentSent(), []);
});

test('Chat with no agreement names the provider and sends nothing', async () => {
  sent.length = 0;
  const result = await askChat({ question: 'what does reduce do here?' });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'consent');
  assert.equal(!result.ok && result.provider, 'unvibe');
  assert.deepEqual(contentSent(), []);
});

test('CC-2: agreeing to Google Gemini through Unvibe does not cover an own key\'s provider', async () => {
  consentStore().agree([...CONSENT_ITEMS], 'unvibe');
  sent.length = 0;
  const res = await postReview(payload('const total = 1;'), null, new AbortController().signal);
  await res.body?.cancel();
  assert.equal(contentSent().length, 1, 'Unvibe\'s server is allowed now');

  writeAiKey('sk-ant-test-key-for-consent');
  settings().set({ useOwnAi: true, aiProvider: 'anthropic' });
  try {
    assert.equal(providerInUse(), 'anthropic');
    const status = consentStatus();
    assert.deepEqual([status.allowed, status.providerName, status.ownKey], [false, 'Anthropic', true]);
    sent.length = 0;
    await refused(() => streamLocalAi({ provider: 'anthropic', apiKey: 'k', system: 's', user: 'u', onToken: () => undefined }), 'anthropic');
    const chat = await askChat({ question: 'and now?' });
    assert.equal(!chat.ok && chat.provider, 'anthropic');
    assert.deepEqual(contentSent(), []);
  } finally {
    settings().set({ useOwnAi: false });
  }
  // The free allowance used up with a key saved: the automatic switch asks before it sends.
  assert.equal(providerInUse(0), 'anthropic');
  assert.equal(providerInUse(5), 'unvibe');
  clearAiKey();
});

test('the agreement is kept on this computer with the provider, policy and time, owner-only', () => {
  const file = path.join(userData, 'unvibe-consent.json');
  const saved = JSON.parse(readFileSync(file, 'utf8')) as { records: ConsentRecord[] };
  const latest = saved.records.at(-1)!;
  assert.deepEqual([latest.provider, latest.policyVersion, latest.items], ['unvibe', POLICY_VERSION, [...CONSENT_ITEMS]]);
  assert.ok(!Number.isNaN(Date.parse(latest.agreedAt)));
  if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
});

test('CC-5: the off switch stops the next send at once and keeps the record', async () => {
  assert.equal(sendingSwitchedOff(), false);
  consentStore().revoke();
  assert.equal(sendingSwitchedOff(), true);
  sent.length = 0;
  await refused(() => postReview(payload('const total = 1;'), null, new AbortController().signal), 'unvibe');
  assert.deepEqual(sent, []);
  assert.deepEqual(shortcutKeys('Control+Alt+U', true, sendingSwitchedOff()), [], 'no shortcut, the Mac\'s Control+U included');
  assert.deepEqual(shortcutKeys('Control+Alt+U', false, sendingSwitchedOff()), []);
  const records = consentStore().all();
  assert.ok(records.length >= 1 && records.every((record) => record.revokedAt), 'withdrawn, not deleted');
  consentStore().agree([...CONSENT_ITEMS], 'unvibe');
  assert.equal(sendingSwitchedOff(), false, 'agreeing again turns it back on');
  assert.deepEqual(shortcutKeys('Control+Alt+U', true, sendingSwitchedOff()), ['Control+Alt+U', 'Control+U']);
  assert.deepEqual(shortcutKeys('Control+Alt+U', false, sendingSwitchedOff()), ['Control+Alt+U']);
});
