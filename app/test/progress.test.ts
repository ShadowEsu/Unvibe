import assert from 'node:assert/strict';
import test from 'node:test';
import { aiAuthHeaders, postTrialProgress, trialAuthHeaders } from '../src/main/backend';
import { sendProgress, syncProgress, type ProgressDeps, type ProgressStep } from '../src/main/progress';
import { netCalls } from './electronStub';

/** A fake install: `persisted` stands in for unvibe-store.json, so a "restart" keeps it. */
function fakeInstall(options: { enabled?: boolean; platform?: NodeJS.Platform; status?: number | null; persisted?: Partial<Record<ProgressStep, true>> } = {}) {
  const persisted = options.persisted ?? {};
  const posts: ProgressStep[] = [];
  let status = options.status === undefined ? 204 : options.status;
  const deps: ProgressDeps = {
    enabled: () => options.enabled ?? true,
    platform: options.platform ?? 'darwin',
    sent: (step) => persisted[step] === true,
    markSent: (step) => { persisted[step] = true; },
    post: async (step) => {
      posts.push(step);
      if (status === null) throw new Error('offline');
      return status;
    },
  };
  return { deps, posts, persisted, setStatus: (next: number | null) => { status = next; } };
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
