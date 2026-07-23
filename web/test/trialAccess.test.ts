import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { reserveTrialAction, trialInstallFromRequest, trialInstallKey, trialUsageOverview } from '../src/lib/trialAccess';

const PREV = { ...process.env };

afterEach(() => {
  process.env.UNVIBE_TRIAL_TOKEN = PREV.UNVIBE_TRIAL_TOKEN;
  process.env.UNVIBE_TRIAL_MONTHLY_LIMIT = PREV.UNVIBE_TRIAL_MONTHLY_LIMIT;
  process.env.UNVIBE_TRIAL_QUIZ_LIMIT = PREV.UNVIBE_TRIAL_QUIZ_LIMIT;
  process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT = PREV.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT;
  process.env.SUPABASE_URL = PREV.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = PREV.SUPABASE_SERVICE_ROLE_KEY;
  const g = globalThis as unknown as { __unvibeTrialUsage?: Map<string, number> };
  g.__unvibeTrialUsage = new Map();
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
  process.env.UNVIBE_TRIAL_MONTHLY_LIMIT = '2';
  process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT = '100';
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
