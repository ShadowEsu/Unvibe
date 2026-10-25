import assert from 'node:assert/strict';
import test from 'node:test';
import { stagingConfig } from '../scripts/staging-guard';

const STAGING: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'staging',
  STAGING_CONFIRMATION: 'UNVIBE_STAGING_ONLY',
  SUPABASE_URL: 'https://stagingref.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  WEB_BASE_URL: 'https://staging.example.test',
  STAGING_PROJECT_REF: 'stagingref',
  STAGING_ALLOWED_SUPABASE_HOSTS: 'stagingref.supabase.co',
};

test('the staging scripts run only with a Stripe test key or none', () => {
  for (const key of [undefined, 'sk_test_fake', 'rk_test_fake']) {
    assert.equal(stagingConfig({ ...STAGING, STRIPE_SECRET_KEY: key }).webBaseUrl, 'https://staging.example.test', String(key));
  }
  for (const key of ['sk_live_fake', 'rk_live_fake', ' sk_live_fake', 'pk_test_fake', 'sk_tes_fake']) {
    assert.throws(() => stagingConfig({ ...STAGING, STRIPE_SECRET_KEY: key }), /not a test key/, key);
  }
});
