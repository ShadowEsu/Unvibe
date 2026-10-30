import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PMF_CONSENT_LINE,
  PMF_QUESTIONS,
  PMF_Q1_OPTIONS,
  PMF_SECRET_BLOCKED,
  cleanPmfDraft,
  type PmfDraft,
  type PmfRequestBody,
  type PmfStatus,
} from '../src/core/pmf';
import { PMF_SEND_FAILED, dismissPmf, pmfCardState, savePmfDraft, sendPmfAnswer, type PmfDeps } from '../src/main/pmf';
import { postPmfAnswer, trialAuthHeaders } from '../src/main/backend';
import { netCalls } from './electronStub';

const DAY = 86_400_000;
const NOW = new Date('2026-11-10T12:00:00.000Z');
const EMPTY: PmfDraft = { q1: '', q2: '', q3: '', q4: '' };

/**
 * A fake install: `saved` stands in for unvibe-store.json (drafts are ignored once sent or closed,
 * as in store.ts), `run` for this run of the app's memory, and `answer` is what the server replies.
 * A "restart" is a new fakeInstall given the old `saved` values.
 */
function fakeInstall(options: { explanations?: number; firstRunDaysAgo?: number; status?: PmfStatus; draft?: PmfDraft; answer?: number | null | 'throw'; canSend?: boolean } = {}) {
  const saved: { status?: PmfStatus; draft: PmfDraft } = { status: options.status, draft: options.draft ?? { ...EMPTY } };
  const run = { shown: false };
  const posts: PmfRequestBody[] = [];
  let answer = options.answer === undefined ? 201 : options.answer;
  const deps: PmfDeps = {
    now: () => NOW,
    explanations: () => options.explanations ?? 5,
    firstRunAt: () => new Date(NOW.getTime() - (options.firstRunDaysAgo ?? 4.5) * DAY).toISOString(),
    status: () => saved.status,
    draft: () => saved.draft,
    saveDraft: (draft) => { if (saved.status !== 'sent' && saved.status !== 'dismissed') saved.draft = draft; },
    // Only the status: clearing the draft is pmf.ts's job, so these tests prove it does.
    setStatus: (status) => { saved.status = status; },
    shownThisRun: () => run.shown,
    markShownThisRun: () => { run.shown = true; },
    installId: () => 'install123abc',
    post: options.canSend === false ? null : async (body) => {
      posts.push(body);
      if (answer === 'throw') throw new Error('offline');
      return answer;
    },
    appVersion: '0.1.47',
  };
  return { deps, saved, run, posts, reply: (next: number | null | 'throw') => { answer = next; } };
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

test('shown in one run only: still shown later in the same run, never after a restart', () => {
  const install = fakeInstall();
  assert.equal(pmfCardState(install.deps).show, true);
  assert.equal(install.saved.status, 'shown', 'persisted the first time it shows');
  assert.equal(install.run.shown, true);
  savePmfDraft(answers, install.deps);
  assert.deepEqual(pmfCardState(install.deps), { show: true, draft: answers }, 'same run: still shown, with the draft');
  const restarted = fakeInstall({ status: install.saved.status, draft: install.saved.draft });
  assert.equal(pmfCardState(restarted.deps).show, false, 'after a restart it never comes back');
  assert.equal(restarted.posts.length + install.posts.length, 0);
});

test('nothing is sent before Send: showing the card and typing only save on this computer', () => {
  const install = fakeInstall();
  pmfCardState(install.deps);
  savePmfDraft({ q1: 'somewhat', q2: 'Students', q3: '', q4: '' }, install.deps);
  savePmfDraft({ ...answers }, install.deps);
  assert.deepEqual(install.saved.draft, answers);
  assert.equal(install.posts.length, 0);
});

test('close (Not now or ×) sends nothing, deletes the draft and the card never shows again', () => {
  const install = fakeInstall({ draft: answers });
  dismissPmf(install.deps);
  assert.equal(install.posts.length, 0);
  assert.equal(install.saved.status, 'dismissed');
  assert.deepEqual(install.saved.draft, EMPTY, 'draft() is empty after close');
  assert.deepEqual(install.deps.draft(), EMPTY);
  assert.equal(pmfCardState(install.deps).show, false);
});

test('Send posts only the answers, the version and the consent marker, once; then the survey is done', async () => {
  const install = fakeInstall({ draft: answers });
  assert.deepEqual(await sendPmfAnswer(answers, install.deps), { ok: true, installId: 'install123abc' }, 'the result carries the install ID for deletion requests');
  assert.deepEqual(install.posts, [{
    q1: 'very', q2: 'Bootcamp students', q3: 'I can read what the AI wrote', q4: '', appVersion: '0.1.47', consent: 'pmf-v1',
  }]);
  assert.equal(install.saved.status, 'sent');
  assert.deepEqual(install.deps.draft(), EMPTY, 'draft() is empty after a sent answer');
  assert.equal(pmfCardState(install.deps).show, false, 'never shown again');
  assert.deepEqual(await sendPmfAnswer(answers, install.deps), { ok: true, installId: 'install123abc' });
  assert.equal(install.posts.length, 1, 'a second press sends nothing');
});

test('409 (the server says this install is not due for 90 days) also finishes the survey', async () => {
  const install = fakeInstall({ answer: 409 });
  assert.deepEqual(await sendPmfAnswer(answers, install.deps), { ok: true, installId: 'install123abc' });
  assert.equal(install.saved.status, 'sent');
  assert.deepEqual(install.deps.draft(), EMPTY);
});

test('the secret filter blocks Send with Security\'s wording; nothing is posted and the draft stays', async () => {
  for (const [key, text] of [
    // AWS's documented example key and generated look-alikes, so no key-shaped literal sits in the repo.
    ['q2', 'AKIAIOSFODNN7EXAMPLE'],
    ['q3', `my key is sk-proj-${'a1B2'.repeat(12)}`],
    ['q4', `-----BEGIN ${'RSA'} PRIVATE KEY-----`],
  ] as const) {
    const install = fakeInstall();
    const draft = { ...answers, [key]: text };
    assert.deepEqual(await sendPmfAnswer(draft, install.deps), { ok: false, error: PMF_SECRET_BLOCKED }, key);
    assert.equal(PMF_SECRET_BLOCKED, 'That looks like a key or password. Take it out and try again.');
    assert.equal(install.posts.length, 0, key);
    assert.equal(install.saved.status, undefined);
    assert.equal(install.saved.draft[key], text, 'kept on this computer so it can be edited');
  }
});

test('length caps: each text is cut to 2,000 characters before it is saved or sent', async () => {
  const install = fakeInstall();
  const long = 'Students learning to code who want plain answers. ';
  await sendPmfAnswer({ q1: 'somewhat', q2: long.repeat(60), q3: 'b'.repeat(2000), q4: 7, extra: 'dropped' }, install.deps);
  const body = install.posts[0]!;
  assert.equal(body.q2, long.repeat(60).slice(0, 2000).trim(), 'cut to 2,000, then trimmed for sending');
  assert.equal(body.q3.length, 2000);
  assert.equal(body.q4, '');
  assert.deepEqual(Object.keys(body).sort(), ['appVersion', 'consent', 'q1', 'q2', 'q3', 'q4']);
  assert.equal(cleanPmfDraft({ q2: 'x'.repeat(2001) }).q2.length, 2000);
});

test('a failed send keeps the draft, shows a retry, and is never retried by itself', async () => {
  for (const failure of [null, 'throw', 500, 503, 401, 413] as const) {
    const install = fakeInstall({ answer: failure });
    const result = await sendPmfAnswer(answers, install.deps);
    assert.deepEqual(result, { ok: false, error: PMF_SEND_FAILED }, String(failure));
    assert.equal(install.saved.status, undefined);
    assert.deepEqual(install.saved.draft, answers, 'the answers stay on this computer');
    assert.equal(install.posts.length, 1, 'exactly one attempt per press; pmf.ts schedules no timer, so nothing retries later');
    install.reply(201);
    assert.deepEqual(await sendPmfAnswer(install.saved.draft, install.deps), { ok: true, installId: 'install123abc' }, 'the person retries');
    assert.equal(install.saved.status, 'sent');
  }
  for (const code of [400, 429]) {
    const install = fakeInstall({ answer: code });
    const result = await sendPmfAnswer(answers, install.deps);
    assert.equal(result.ok, false);
    assert.equal(install.saved.status, undefined);
    assert.deepEqual(install.saved.draft, answers);
  }
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
    assert.equal(seen[0]!.headers.get('content-type'), 'application/json');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('the card copy is the spec wording with Unvibe, Security\'s consent line, and no dashes', () => {
  assert.equal(PMF_QUESTIONS.q1, 'How would you feel if you could no longer use Unvibe?');
  assert.equal(PMF_QUESTIONS.q2, 'What type of people do you think would most benefit from Unvibe?');
  assert.equal(PMF_QUESTIONS.q3, 'What is the main benefit you receive from Unvibe?');
  assert.equal(PMF_QUESTIONS.q4, 'How can we improve Unvibe for you?');
  assert.deepEqual(PMF_Q1_OPTIONS.map((o) => o.label), ['Very disappointed', 'Somewhat disappointed', 'Not disappointed', 'N/A, I no longer use it']);
  assert.equal(PMF_CONSENT_LINE, "Your answers and a random install ID go to Unvibe's server so the team can read them. Nothing is sent until you press Send. Don't include passwords, keys or other people's personal details.");
  const copy = [...Object.values(PMF_QUESTIONS), ...PMF_Q1_OPTIONS.map((o) => o.label), PMF_CONSENT_LINE, PMF_SEND_FAILED, PMF_SECRET_BLOCKED].join(' ');
  assert.equal(/[\u2013\u2014]/.test(copy), false);
  assert.equal(/partner|official|trusted by/i.test(copy), false);
});
