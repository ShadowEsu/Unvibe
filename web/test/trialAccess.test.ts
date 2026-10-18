import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { reserveTrialAction, trialInstallFromRequest, trialInstallKey, trialUsageOverview } from '../src/lib/trialAccess';

const PREV = { ...process.env };

afterEach(() => {
  process.env.UNVIBE_TRIAL_TOKEN = PREV.UNVIBE_TRIAL_TOKEN;
  process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT = PREV.UNVIBE_TRIAL_EXPLANATION_LIMIT;
  process.env.UNVIBE_TRIAL_FOLLOW_UP_LIMIT = PREV.UNVIBE_TRIAL_FOLLOW_UP_LIMIT;
  process.env.UNVIBE_TRIAL_GLOBAL_LIMIT = PREV.UNVIBE_TRIAL_GLOBAL_LIMIT;
  process.env.SUPABASE_URL = PREV.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = PREV.SUPABASE_SERVICE_ROLE_KEY;
  const g = globalThis as unknown as { __unvibeTrialUsage?: Map<string, { used: number }>; __unvibeTrialInstalls?: Map<string, { startedAt: string }> };
  g.__unvibeTrialUsage = new Map();
  g.__unvibeTrialInstalls = new Map();
});

test('trialInstallFromRequest accepts matching bearer + install id', () => {
  process.env.UNVIBE_TRIAL_TOKEN = 'trial-secret-value-abcdefghijklmnop';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const req = new Request('http://localhost/api', {
    headers: {
      authorization: 'Bearer trial-secret-value-abcdefghijklmnop',
      'x-unvibe-install-id': 'abcd1234efgh5678',
    },
  });
  assert.equal(trialInstallFromRequest(req), trialInstallKey('abcd1234efgh5678'));
});

test('trialInstallFromRequest rejects wrong token', () => {
  process.env.UNVIBE_TRIAL_TOKEN = 'trial-secret-value-abcdefghijklmnop';
  const req = new Request('http://localhost/api', {
    headers: {
      authorization: 'Bearer wrong-token-value-abcdefghijklmnop',
      'x-unvibe-install-id': 'abcd1234efgh5678',
    },
  });
  assert.equal(trialInstallFromRequest(req), null);
});

test('reserveTrialAction enforces per-install monthly limit', async () => {
  process.env.UNVIBE_TRIAL_TOKEN = 'trial-secret-value-abcdefghijklmnop';
  process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT = '2';
  process.env.UNVIBE_TRIAL_GLOBAL_LIMIT = '100';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = trialInstallKey(`limit-test-${Date.now()}`);
  assert.equal(await reserveTrialAction(key, 'ai_explanation'), null);
  assert.equal(await reserveTrialAction(key, 'ai_explanation'), null);
  const denied = await reserveTrialAction(key, 'ai_explanation');
  assert.ok(denied);
  assert.equal(denied.status, 429);
  const overview = await trialUsageOverview(key);
  const line = overview.usage.find((u) => u.kind === 'ai_explanation');
  assert.equal(line?.used, 2);
  assert.equal(line?.remaining, 0);
});


test('trial access expires 30 days after the first action', async () => {
  process.env.UNVIBE_TRIAL_TOKEN = 'trial-secret-value-abcdefghijklmnop';
  process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT = '50';
  process.env.UNVIBE_TRIAL_GLOBAL_LIMIT = '100';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = trialInstallKey(`expiry-test-${Date.now()}`);
  const startsAt = new Date('2026-09-01T00:00:00.000Z');
  assert.equal(await reserveTrialAction(key, 'ai_explanation', startsAt), null);
  const denied = await reserveTrialAction(key, 'ai_explanation', new Date('2026-10-02T00:00:00.000Z'));
  assert.ok(denied);
  assert.equal(denied.status, 429);
});

test('with Supabase, reserveTrialAction uses trial_reserve for the install and the global counter', async () => {
  process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT = '2';
  process.env.UNVIBE_TRIAL_GLOBAL_LIMIT = '100';
  process.env.SUPABASE_URL = 'https://trial.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  const key = trialInstallKey('supabase-path-test');
  const rpcCalls: Array<{ p_install_key: string; p_kind: string; p_limit: number }> = [];
  const results: Record<string, number> = { [key]: 1, __global__: -1 };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/trial_reserve') {
      const args = JSON.parse(String(init?.body));
      rpcCalls.push(args);
      return Response.json(results[args.p_install_key]);
    }
    if (url.pathname === '/rest/v1/trial_installs' && init?.method === 'POST') return new Response(null, { status: 201 });
    if (url.pathname === '/rest/v1/trial_installs') return Response.json([{ started_at: new Date().toISOString() }]);
    if (url.pathname === '/rest/v1/trial_usage') return Response.json([{ used: 2 }]);
    throw new Error(`unexpected request ${url}`);
  }) as typeof fetch;
  try {
    const globalFull = await reserveTrialAction(key, 'ai_explanation');
    assert.equal(globalFull?.status, 429);
    assert.match((await globalFull!.json()).message, /temporarily full/);
    assert.deepEqual(rpcCalls, [
      { p_install_key: key, p_kind: 'ai_explanation', p_limit: 2 },
      { p_install_key: '__global__', p_kind: 'ai_explanation', p_limit: 100 },
    ]);

    results[key] = -1;
    const installFull = await reserveTrialAction(key, 'ai_explanation');
    assert.equal(installFull?.status, 429);
    const body = await installFull!.json();
    assert.match(body.message, /includes 2 AI explanations/);
    assert.equal(body.usage.used, 2);
    assert.equal(rpcCalls.length, 3);
  } finally {
    globalThis.fetch = original;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
