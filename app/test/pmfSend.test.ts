import test from 'node:test';
import assert from 'node:assert/strict';
import { PMF_CONSENT_LINE, PMF_QUESTIONS, PMF_Q1_OPTIONS, type PmfDraft, type PmfRequestBody, type PmfStatus } from '../src/core/pmf';
import { PMF_SEND_FAILED, pmfCardState, sendPmfAnswer, type PmfDeps } from '../src/main/pmf';
import { postPmfAnswer, trialAuthHeaders } from '../src/main/backend';
import { netCalls } from './electronStub';

const DAY = 86_400_000;
const NOW = new Date('2026-11-10T12:00:00.000Z');

/** A fake install: `saved` stands in for unvibe-store.json; `answer` is what the server replies. */
function fakeInstall(options: { explanations?: number; firstRunDaysAgo?: number; status?: PmfStatus; draft?: PmfDraft; answer?: number | null | 'throw'; canSend?: boolean } = {}) {
  const saved: { status?: PmfStatus; draft: PmfDraft } = { status: options.status, draft: options.draft ?? { q1: '', q2: '', q3: '', q4: '' } };
  const posts: PmfRequestBody[] = [];
  let answer = options.answer === undefined ? 201 : options.answer;
  const deps: PmfDeps = {
    now: () => NOW,
    explanations: () => options.explanations ?? 5,
    firstRunAt: () => new Date(NOW.getTime() - (options.firstRunDaysAgo ?? 4.5) * DAY).toISOString(),
    status: () => saved.status,
    draft: () => saved.draft,
    saveDraft: (draft) => { saved.draft = draft; },
    setStatus: (status) => { saved.status = status; saved.draft = { q1: '', q2: '', q3: '', q4: '' }; },
    post: options.canSend === false ? null : async (body) => {
      posts.push(body);
      if (answer === 'throw') throw new Error('offline');
      return answer;
    },
    appVersion: '0.1.47',
  };
  return { deps, saved, posts, reply: (next: number | null | 'throw') => { answer = next; } };
}

const answers: PmfDraft = { q1: 'very', q2: '  Bootcamp students ', q3: 'I can read what the AI wrote', q4: '' };

test('the card shows only when eligible and the build can send, with the saved draft', () => {
  assert.deepEqual(pmfCardState(fakeInstall({ draft: answers }).deps), { show: true, draft: answers });
  assert.equal(pmfCardState(fakeInstall({ explanations: 2 }).deps).show, false);
  assert.equal(pmfCardState(fakeInstall({ firstRunDaysAgo: 2.9 }).deps).show, false);
  assert.equal(pmfCardState(fakeInstall({ status: 'dismissed' }).deps).show, false);
  assert.equal(pmfCardState(fakeInstall({ status: 'sent' }).deps).show, false);
  assert.equal(pmfCardState(fakeInstall({ canSend: false }).deps).show, false, 'no trial token: answers could never leave, so no card');
});

test('Send posts the exact body once, then the survey is done and the draft deleted', async () => {
  const install = fakeInstall();
  assert.deepEqual(await sendPmfAnswer(answers, install.deps), { ok: true });
  assert.deepEqual(install.posts, [{
    q1: 'very', q2: 'Bootcamp students', q3: 'I can read what the AI wrote', q4: '',
    explanations: 5, daysSinceInstall: 4, appVersion: '0.1.47', consent: 'pmf-v1',
  }]);
  assert.equal(install.saved.status, 'sent');
  assert.equal(pmfCardState(install.deps).show, false, 'never shown again');
  assert.deepEqual(await sendPmfAnswer(answers, install.deps), { ok: true });
  assert.equal(install.posts.length, 1, 'a second press sends nothing');
});

test('409 (already answered within 90 days) also finishes the survey', async () => {
  const install = fakeInstall({ answer: 409 });
  assert.deepEqual(await sendPmfAnswer(answers, install.deps), { ok: true });
  assert.equal(install.saved.status, 'sent');
});

test('a failed send keeps the draft, shows a retry, and is never retried by itself', async () => {
  for (const failure of [null, 'throw', 500, 503, 400, 401, 413] as const) {
    const install = fakeInstall({ answer: failure });
    const result = await sendPmfAnswer(answers, install.deps);
    assert.deepEqual(result, { ok: false, error: PMF_SEND_FAILED }, String(failure));
    assert.equal(install.saved.status, undefined);
    assert.deepEqual(install.saved.draft, answers, 'the answers stay on this computer');
    assert.equal(install.posts.length, 1, 'exactly one attempt per press; pmf.ts schedules no timer, so nothing retries later');
    install.reply(201);
    assert.deepEqual(await sendPmfAnswer(install.saved.draft, install.deps), { ok: true }, 'the person retries');
    assert.equal(install.saved.status, 'sent');
  }
  const limited = fakeInstall({ answer: 429 });
  const result = await sendPmfAnswer(answers, limited.deps);
  assert.equal(result.ok, false);
  assert.deepEqual(limited.saved.draft, answers);
});

test('nothing is sent without a Q1 answer, after Not now, or from a build that cannot send', async () => {
  const noQ1 = fakeInstall();
  assert.deepEqual(await sendPmfAnswer({ ...answers, q1: '' }, noQ1.deps), { ok: false, error: 'Pick an answer to the first question.' });
  assert.deepEqual(await sendPmfAnswer({ ...answers, q1: 'Very disappointed' }, noQ1.deps), { ok: false, error: 'Pick an answer to the first question.' });
  assert.equal(noQ1.posts.length, 0);
  const dismissed = fakeInstall({ status: 'dismissed' });
  assert.equal((await sendPmfAnswer(answers, dismissed.deps)).ok, false);
  assert.equal(dismissed.posts.length, 0);
  assert.equal((await sendPmfAnswer(answers, fakeInstall({ canSend: false }).deps)).ok, false);
});

test('renderer input is cleaned before it is saved or sent', async () => {
  const install = fakeInstall();
  await sendPmfAnswer({ q1: 'somewhat', q2: 'x'.repeat(1500), q3: 7, q4: ['a'], extra: 'dropped' }, install.deps);
  const body = install.posts[0]!;
  assert.equal(body.q2.length, 1000);
  assert.equal(body.q3, '');
  assert.equal(body.q4, '');
  assert.deepEqual(Object.keys(body).sort(), ['appVersion', 'consent', 'daysSinceInstall', 'explanations', 'q1', 'q2', 'q3', 'q4']);
});

test('the request goes through the backend helper with trial headers, and never without them', async () => {
  netCalls.length = 0;
  assert.equal(await postPmfAnswer({ q1: 'very' }, {}), null);
  assert.deepEqual(netCalls, [], 'no authorization header, no request');
  // Electron's net is the stub (it records and fails), so the helper falls back to fetch once.
  const previousFetch = globalThis.fetch;
  const seen: Array<{ url: string; body: string; headers: Headers }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), body: String(init?.body), headers: new Headers(init?.headers) });
    return Response.json({ ok: true }, { status: 201 });
  }) as typeof fetch;
  try {
    const status = await postPmfAnswer({ q1: 'very', consent: 'pmf-v1' }, trialAuthHeaders('trial-token', 'install123abc', 'darwin', '0.1.47'));
    assert.equal(status, 201);
    assert.equal(seen.length, 1);
    assert.match(seen[0]!.url, /\/api\/v1\/feedback\/pmf$/);
    assert.equal(seen[0]!.body, '{"q1":"very","consent":"pmf-v1"}');
    assert.equal(seen[0]!.headers.get('authorization'), 'Bearer trial-token');
    assert.equal(seen[0]!.headers.get('x-unvibe-install-id'), 'install123abc');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('the card copy is the spec wording with Unvibe, the consent line is exact, and no dashes', () => {
  assert.equal(PMF_QUESTIONS.q1, 'How would you feel if you could no longer use Unvibe?');
  assert.equal(PMF_QUESTIONS.q2, 'What type of people do you think would most benefit from Unvibe?');
  assert.equal(PMF_QUESTIONS.q3, 'What is the main benefit you receive from Unvibe?');
  assert.equal(PMF_QUESTIONS.q4, 'How can we improve Unvibe for you?');
  assert.deepEqual(PMF_Q1_OPTIONS.map((o) => o.label), ['Very disappointed', 'Somewhat disappointed', 'Not disappointed', 'N/A, I no longer use it']);
  assert.equal(PMF_CONSENT_LINE, "Send shares these answers, how many explanations you've had and how many days since install with Unvibe, under an anonymous install ID. Nothing leaves your Mac until you press Send.");
  const copy = [...Object.values(PMF_QUESTIONS), ...PMF_Q1_OPTIONS.map((o) => o.label), PMF_CONSENT_LINE, PMF_SEND_FAILED].join(' ');
  assert.equal(/[\u2013\u2014]/.test(copy), false);
  assert.equal(/partner|official|trusted by/i.test(copy), false);
});
