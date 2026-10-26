import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { reserveTrialAction, trialGlobalDayKey, trialGlobalMonthKey, trialInstallFromRequest, trialInstallKey, trialIpKey, trialInstallMeta, trialUsageOverview } from '../src/lib/trialAccess';

const IP = '203.0.113.5';

const PREV = { ...process.env };

afterEach(() => {
  process.env.UNVIBE_TRIAL_TOKEN = PREV.UNVIBE_TRIAL_TOKEN;
  process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT = PREV.UNVIBE_TRIAL_EXPLANATION_LIMIT;
  process.env.UNVIBE_TRIAL_FOLLOW_UP_LIMIT = PREV.UNVIBE_TRIAL_FOLLOW_UP_LIMIT;
  process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT = PREV.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT;
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
  process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT = '100';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = trialInstallKey(`limit-test-${Date.now()}`);
  assert.equal((await reserveTrialAction(key, 'ai_explanation', IP)).denied, null);
  assert.equal((await reserveTrialAction(key, 'ai_explanation', IP)).denied, null);
  const { denied } = await reserveTrialAction(key, 'ai_explanation', IP);
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
  process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT = '100';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = trialInstallKey(`expiry-test-${Date.now()}`);
  const startsAt = new Date('2026-09-01T00:00:00.000Z');
  assert.equal((await reserveTrialAction(key, 'ai_explanation', IP, startsAt)).denied, null);
  const { denied } = await reserveTrialAction(key, 'ai_explanation', IP, new Date('2026-10-02T00:00:00.000Z'));
  assert.ok(denied);
  assert.equal(denied.status, 429);
});

test('with Supabase, reserveTrialAction uses trial_reserve for the install, per-IP and global counters', async () => {
  process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT = '2';
  process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT = '100';
  process.env.UNVIBE_TRIAL_GLOBAL_DAILY_LIMIT = '10';
  process.env.UNVIBE_TRIAL_IP_DAILY_LIMIT = '5';
  process.env.SUPABASE_URL = 'https://trial.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  const key = trialInstallKey('supabase-path-test');
  const now = new Date();
  const rpcCalls: Array<{ p_install_key: string; p_kind: string; p_limit: number }> = [];
  const results: Record<string, number> = { [key]: 1, [trialGlobalMonthKey(now)]: -1 };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/trial_reserve') {
      const args = JSON.parse(String(init?.body));
      rpcCalls.push(args);
      return Response.json(results[args.p_install_key] ?? 1);
    }
    if (url.pathname === '/rest/v1/trial_installs' && init?.method === 'POST') return new Response(null, { status: 201 });
    if (url.pathname === '/rest/v1/trial_installs') return Response.json([{ started_at: new Date().toISOString() }]);
    if (url.pathname === '/rest/v1/trial_counters') return Response.json([{ used: 2 }]);
    throw new Error(`unexpected request ${url}`);
  }) as typeof fetch;
  try {
    const globalFull = (await reserveTrialAction(key, 'ai_explanation', IP, now)).denied;
    assert.equal(globalFull?.status, 429);
    assert.match((await globalFull!.json()).message, /temporarily full/);
    assert.deepEqual(rpcCalls, [
      { p_install_key: key, p_kind: 'ai_explanation', p_limit: 2 },
      { p_install_key: trialIpKey(IP, now), p_kind: 'ai_explanation', p_limit: 5 },
      { p_install_key: trialGlobalMonthKey(now), p_kind: 'ai_explanation', p_limit: 100 },
      { p_install_key: trialGlobalDayKey(now), p_kind: 'ai_explanation', p_limit: 10 },
    ]);

    results[key] = -1;
    const installFull = (await reserveTrialAction(key, 'ai_explanation', IP, now)).denied;
    assert.equal(installFull?.status, 429);
    const body = await installFull!.json();
    assert.match(body.message, /includes 2 AI explanations/);
    assert.equal(body.usage.used, 2);
    assert.equal(rpcCalls.length, 5, 'an install over its own limit never touches the shared counters');
  } finally {
    globalThis.fetch = original;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

test('install meta keeps only mac/win and a plain x.y.z version', () => {
  const meta = (platform?: string, version?: string) => trialInstallMeta(new Request('http://localhost/api', {
    headers: { ...(platform === undefined ? {} : { 'x-unvibe-platform': platform }), ...(version === undefined ? {} : { 'x-unvibe-version': version }) },
  }));
  assert.deepEqual(meta('mac', '0.1.44'), { platform: 'mac', firstVersion: '0.1.44' });
  assert.deepEqual(meta('win', '1.2.3'), { platform: 'win', firstVersion: '1.2.3' });
  assert.deepEqual(meta('linux', '0.1.44-beta'), { platform: null, firstVersion: null });
  assert.deepEqual(meta('Darwin 25.2.0', '0.1'), { platform: null, firstVersion: null });
  assert.deepEqual(meta(), { platform: null, firstVersion: null });
});

test('the first online launch stores platform and first version on insert only', async () => {
  process.env.SUPABASE_URL = 'https://meta.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  const previousFetch = globalThis.fetch;
  const inserts: Array<{ body: Record<string, unknown>; prefer: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/trial_installs') {
      if (init?.method === 'POST') {
        inserts.push({ body: JSON.parse(String(init.body)) as Record<string, unknown>, prefer: new Headers(init.headers).get('prefer') ?? '' });
        return new Response(null, { status: 201 });
      }
      return Response.json([{ started_at: '2026-10-20T00:00:00.000Z' }]);
    }
    if (url.pathname === '/rest/v1/trial_counters') return Response.json([]);
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;
  try {
    const key = trialInstallKey('meta-install-0001');
    await trialUsageOverview(key, new Date('2026-10-20T00:00:00.000Z'), { platform: 'win', firstVersion: '0.1.44' });
    assert.ok(inserts.length > 0);
    for (const insert of inserts) {
      assert.deepEqual(insert.body, { install_key: key, started_at: '2026-10-20T00:00:00.000Z', platform: 'win', first_version: '0.1.44' });
      assert.match(insert.prefer, /resolution=ignore-duplicates/, 'an existing row is never overwritten');
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('before the funnel migration, the first trial explanation still creates the install and starts its 30 days', async () => {
  process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT = '50';
  process.env.SUPABASE_URL = 'https://premigration.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  const previousFetch = globalThis.fetch;
  let startedAt: string | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/trial_reserve') return Response.json(1);
    if (url.pathname === '/rest/v1/trial_installs') {
      if (init?.method !== 'POST') return Response.json(startedAt ? [{ started_at: startedAt }] : []);
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      if ('platform' in body || 'first_version' in body) {
        return Response.json({ code: 'PGRST204', message: "Could not find the 'first_version' column of 'trial_installs' in the schema cache" }, { status: 400 });
      }
      startedAt ??= String(body.started_at);
      return new Response(null, { status: 201 });
    }
    if (url.pathname === '/rest/v1/trial_counters') return Response.json([]);
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;
  try {
    const key = trialInstallKey('premigration-install-0001');
    const meta = { platform: 'mac' as const, firstVersion: '0.1.44' };
    const first = await reserveTrialAction(key, 'ai_explanation', IP, new Date('2026-10-01T00:00:00.000Z'), meta);
    assert.equal(first.denied, null);
    assert.equal(startedAt, '2026-10-01T00:00:00.000Z');
    const later = await reserveTrialAction(key, 'ai_explanation', IP, new Date('2026-11-02T00:00:00.000Z'), meta);
    assert.equal(later.denied?.status, 429, 'the trial clock started on the first launch');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
