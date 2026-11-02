import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST as redeemRoute } from '../app/api/v1/promo/redeem/route';
import { resetStoreCacheForTests } from '../src/data/store';
import { ACCOUNT_POLICY_VERSION } from '../src/lib/accountConsent';

// POST /api/v1/promo/redeem asks for /activate's agreement (Terms and Privacy; 18 or older) against
// a fake Supabase (fetch is replaced): refusals touch nothing, and with CONSENTS_TABLE=on the
// agreement is stored before any Pro months are granted.
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const USER_ID = '00000000-0000-4000-8000-0000000000a1';
const GOOD_TOKEN = 'supabase-access-token-good';
const CODE = 'ABCD-EFGH-JKMN-PQRS';
/** Every request the route made to Supabase, as "METHOD path". */
let requests: string[] = [];
let consentRows: unknown[] = [];
let consentsTableFails = false;

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: 'test', SUPABASE_URL: 'https://db.example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role' };
  delete process.env.CONSENTS_TABLE;
  resetStoreCacheForTests();
  requests = [];
  consentRows = [];
  consentsTableFails = false;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}`);
    if (url.pathname === '/auth/v1/user') {
      return Response.json({ id: USER_ID, email: 'hacker@school.edu', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
    }
    if (url.pathname === '/rest/v1/users') return new Response(null, { status: 201 });
    if (url.pathname === '/rest/v1/consents') {
      if (consentsTableFails) return Response.json({ message: 'relation "public.consents" does not exist' }, { status: 404 });
      consentRows.push(...(await request.json()));
      return new Response(null, { status: 201 });
    }
    if (url.pathname === '/rest/v1/rpc/redeem_promo_code') return Response.json([{ status: 'redeemed', months: 3, pro_until: '2027-02-02T00:00:00+00:00' }]);
    return Response.json({ message: `unexpected ${url.pathname}` }, { status: 500 });
  };
});
afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
  resetStoreCacheForTests();
});

let ipCounter = 0;
function call(agreement: unknown): Promise<Response> {
  ipCounter += 1;
  return redeemRoute(new Request('https://api.example.test/api/v1/promo/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.8.0.${ipCounter}` },
    body: JSON.stringify({ accessToken: GOOD_TOKEN, code: CODE, ...(agreement === undefined ? {} : { agreement }) }),
  }));
}

const both = { terms: true, age18: true, policyVersion: ACCOUNT_POLICY_VERSION };

for (const [name, agreement] of [
  ['no agreement', undefined],
  ['the string "true"', { terms: 'true', age18: 'true', policyVersion: ACCOUNT_POLICY_VERSION }],
  ['Terms only', { terms: true, age18: false, policyVersion: ACCOUNT_POLICY_VERSION }],
  ['18+ only', { terms: false, age18: true, policyVersion: ACCOUNT_POLICY_VERSION }],
  ['an older policy version', { terms: true, age18: true, policyVersion: '2026-01-01' }],
] as const) {
  test(`redeem refuses ${name} before any Supabase call or redemption`, async () => {
    process.env.CONSENTS_TABLE = 'on';
    const response = await call(agreement);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json() as { ok: boolean; error: string; message: string };
    assert.equal(body.ok, false);
    assert.equal(body.error, 'agreement_required');
    assert.match(body.message, /Terms and Privacy Policy and confirm you are 18 or older/);
    assert.deepEqual(requests, [], 'no Supabase request: no session checked, no account written, nothing redeemed');
    assert.deepEqual(consentRows, []);
  });
}

test('with CONSENTS_TABLE=on a valid agreement is stored, then the code is redeemed', async () => {
  process.env.CONSENTS_TABLE = 'on';
  const before = Date.now();
  const response = await call(both);
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { status: string }).status, 'redeemed');
  assert.deepEqual(requests, [
    'GET /auth/v1/user', 'POST /rest/v1/users', 'POST /rest/v1/consents', 'POST /rest/v1/rpc/redeem_promo_code',
  ], 'the account row first, then the agreement, then the grant');
  const rows = consentRows as Array<{ user_id: string; kind: string; policy_version: string; agreed_at: string }>;
  assert.deepEqual(rows.map((r) => [r.user_id, r.kind, r.policy_version]), [
    [USER_ID, 'terms', ACCOUNT_POLICY_VERSION],
    [USER_ID, 'age_18', ACCOUNT_POLICY_VERSION],
  ]);
  for (const row of rows) assert.ok(Date.parse(row.agreed_at) >= before - 1000);
});

test('when the agreement cannot be stored nothing is redeemed', async () => {
  process.env.CONSENTS_TABLE = 'on';
  consentsTableFails = true;
  const response = await call(both);
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { error: string }).error, 'unavailable');
  assert.ok(!requests.includes('POST /rest/v1/rpc/redeem_promo_code'), 'no Pro months without a stored agreement');
});

test('with the consents table off a valid agreement redeems and nothing is written to it', async () => {
  const response = await call(both);
  assert.equal(response.status, 200);
  assert.deepEqual(requests, ['GET /auth/v1/user', 'POST /rest/v1/users', 'POST /rest/v1/rpc/redeem_promo_code']);
});
