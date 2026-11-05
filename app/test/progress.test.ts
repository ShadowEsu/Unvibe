import assert from 'node:assert/strict';
import test from 'node:test';
import { aiAuthHeaders, postTrialProgress, trialAuthHeaders } from '../src/main/backend';
import { answerHeardFrom, cleanHeardFrom, sendProgress, syncProgress, type ProgressDeps, type ProgressStep } from '../src/main/progress';
import { netCalls } from './electronStub';

/**
 * A fake install: `persisted` stands in for unvibe-store.json, so a "restart" keeps it. `local.heardFrom`
 * is the answer waiting to be sent, cleared once it is sent, as the store does.
 */
function fakeInstall(options: { enabled?: boolean; trialBuild?: boolean; platform?: NodeJS.Platform; status?: number | null; persisted?: Partial<Record<ProgressStep, true>> } = {}) {
  const persisted = options.persisted ?? {};
  const posts: ProgressStep[] = [];
  const answers: string[] = [];
  const local: { heardFrom: string | null; enabled: boolean; trialBuild: boolean } = { heardFrom: null, enabled: options.enabled ?? true, trialBuild: options.trialBuild ?? true };
  let status = options.status === undefined ? 204 : options.status;
  const deps: ProgressDeps = {
    trialBuild: () => local.trialBuild,
    enabled: () => local.trialBuild && local.enabled,
    platform: options.platform ?? 'darwin',
    sent: (step) => persisted[step] === true,
    markSent: (step) => {
      persisted[step] = true;
      if (step === 'heard_from') local.heardFrom = null;
    },
    heardFrom: () => local.heardFrom,
    saveHeardFrom: (answer) => { local.heardFrom = answer; },
    post: async (step, answer) => {
      posts.push(step);
      if (answer !== undefined) answers.push(answer);
      if (status === null) throw new Error('offline');
      return status;
    },
  };
  return { deps, posts, answers, persisted, local, setStatus: (next: number | null) => { status = next; } };
}

test('nothing is sent when the build or the setting turns progress off', async () => {
  const install = fakeInstall({ enabled: false });
  await sendProgress('onboarded', install.deps);
  assert.deepEqual(install.posts, []);
});

test('each step is sent once, across repeated calls and a restart', async () => {
  const install = fakeInstall();
  await sendProgress('onboarded', install.deps);
  await sendProgress('onboarded', install.deps);
  await Promise.all([sendProgress('level_answered', install.deps), sendProgress('level_answered', install.deps)]);
  assert.deepEqual(install.posts, ['onboarded', 'level_answered']);
  const restarted = fakeInstall({ persisted: install.persisted });
  await sendProgress('onboarded', restarted.deps);
  assert.deepEqual(restarted.posts, [], 'progressSent survives a restart');
});

test('offline, 409, 429 and 5xx leave the step unsent; syncProgress retries it', async () => {
  for (const status of [null, 409, 429, 503]) {
    const install = fakeInstall({ status });
    await sendProgress('onboarded', install.deps);
    assert.equal(install.persisted.onboarded, undefined, String(status));
    install.setStatus(204);
    await syncProgress({ onboarded: true, accessibilityGranted: false, signedIn: false }, install.deps);
    assert.equal(install.persisted.onboarded, true, `retried after ${status}`);
    assert.deepEqual(install.posts, ['onboarded', 'onboarded']);
  }
});

test('2xx and 400 mark the step sent', async () => {
  for (const status of [204, 200, 400]) {
    const install = fakeInstall({ status });
    await sendProgress('signed_in', install.deps);
    assert.equal(install.persisted.signed_in, true, String(status));
  }
});

test('Accessibility steps are never sent on Windows', async () => {
  const install = fakeInstall({ platform: 'win32' });
  await sendProgress('accessibility', install.deps);
  await sendProgress('accessibility_asked', install.deps);
  await syncProgress({ onboarded: true, accessibilityGranted: true, signedIn: true }, install.deps);
  assert.deepEqual(install.posts.sort(), ['onboarded', 'signed_in']);
});

test('trial headers carry the platform and version; a session request carries neither', () => {
  assert.deepEqual(trialAuthHeaders('trial-token', 'install123abc', 'darwin', '0.1.44'), {
    authorization: 'Bearer trial-token',
    'x-unvibe-install-id': 'install123abc',
    'x-unvibe-platform': 'mac',
    'x-unvibe-version': '0.1.44',
  });
  assert.equal(trialAuthHeaders('t', 'install123abc', 'win32', '0.1.44')['x-unvibe-platform'], 'win');
  assert.deepEqual(aiAuthHeaders('session-token'), { authorization: 'Bearer session-token' });
});

test('the ping never goes out without trial headers, and its body is only the step', async () => {
  netCalls.length = 0;
  assert.equal(await postTrialProgress('onboarded', aiAuthHeaders(null)), null, 'a build without the trial token sends nothing');
  assert.deepEqual(netCalls, []);
});

test('the ping body is exactly the step, sent with the trial headers only', async () => {
  const previousFetch = globalThis.fetch;
  const seen: Array<{ url: string; body: string; headers: Headers }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), body: String(init?.body), headers: new Headers(init?.headers) });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    const status = await postTrialProgress('accessibility_asked', trialAuthHeaders('trial-token', 'install123abc', 'darwin', '0.1.44'));
    assert.equal(status, 204);
    assert.equal(seen.length, 1);
    assert.match(seen[0]!.url, /\/api\/v1\/trial\/progress$/);
    assert.equal(seen[0]!.body, '{"step":"accessibility_asked"}');
    assert.equal(seen[0]!.headers.get('authorization'), 'Bearer trial-token');
    assert.equal(seen[0]!.headers.get('x-unvibe-install-id'), 'install123abc');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('where you heard about Unvibe is optional: a blank answer keeps and sends nothing, setup goes on', async () => {
  const install = fakeInstall();
  for (const blank of ['', '   ', '\n\t', '\u0000']) await answerHeardFrom(blank, install.deps);
  assert.equal(install.local.heardFrom, null, 'nothing kept');
  await sendProgress('onboarded', install.deps);
  await syncProgress({ onboarded: true, accessibilityGranted: false, signedIn: false }, install.deps);
  assert.deepEqual(install.posts, ['onboarded'], 'no heard_from ping without an answer');
});

test('the answer is cleaned and sent once, across repeats and a restart', async () => {
  const install = fakeInstall();
  await answerHeardFrom('  A   friend\n at work ', install.deps);
  await answerHeardFrom('A video', install.deps);
  await Promise.all([answerHeardFrom('A podcast', install.deps), syncProgress({ onboarded: false, accessibilityGranted: false, signedIn: false }, install.deps)]);
  assert.deepEqual(install.posts, ['heard_from'], 'sent once');
  assert.deepEqual(install.answers, ['A friend at work']);
  assert.equal(install.local.heardFrom, null, 'not kept once the server has it');
  const restarted = fakeInstall({ persisted: install.persisted });
  await answerHeardFrom('A video', restarted.deps);
  await syncProgress({ onboarded: false, accessibilityGranted: false, signedIn: false }, restarted.deps);
  assert.deepEqual(restarted.posts, [], 'progressSent survives a restart');
});

test('typing an answer is its own opt-in: it is sent with setup progress off, and the other steps are not', async () => {
  const install = fakeInstall({ enabled: false });
  await answerHeardFrom('A friend', install.deps);
  await sendProgress('onboarded', install.deps);
  await syncProgress({ onboarded: true, accessibilityGranted: false, signedIn: false }, install.deps);
  assert.deepEqual(install.posts, ['heard_from'], 'only the answer goes with the switch off');
  assert.deepEqual(install.answers, ['A friend']);
});

test('a build that is not a sealed trial build never keeps or sends the answer', async () => {
  const install = fakeInstall({ trialBuild: false });
  await answerHeardFrom('A friend', install.deps);
  await syncProgress({ onboarded: false, accessibilityGranted: false, signedIn: false }, install.deps);
  assert.equal(install.local.heardFrom, null, 'not kept');
  assert.deepEqual(install.posts, [], 'not sent');
});

test('an answer that did not get through is kept and retried next launch, with the switch off too', async () => {
  const install = fakeInstall({ status: 409, enabled: false });
  await answerHeardFrom('A subreddit', install.deps);
  assert.equal(install.local.heardFrom, 'A subreddit', 'kept for the retry');
  install.setStatus(204);
  await syncProgress({ onboarded: false, accessibilityGranted: false, signedIn: false }, install.deps);
  assert.deepEqual(install.answers, ['A subreddit', 'A subreddit']);
  assert.equal(install.persisted.heard_from, true);
  assert.equal(install.local.heardFrom, null, 'cleared once the server has it');
});

test('the answer is capped at 200 characters before it leaves the app', () => {
  assert.equal(cleanHeardFrom('x'.repeat(300)), 'x'.repeat(200));
  assert.equal(Array.from(cleanHeardFrom('\u{1F600}'.repeat(250))).length, 200);
  assert.equal(cleanHeardFrom(7), '');
});

test('the heard_from ping body is the step and the answer only', async () => {
  const previousFetch = globalThis.fetch;
  const bodies: string[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    assert.equal(await postTrialProgress('heard_from', trialAuthHeaders('trial-token', 'install123abc', 'darwin', '0.1.44'), 'A friend'), 204);
    assert.deepEqual(bodies, ['{"step":"heard_from","answer":"A friend"}']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
