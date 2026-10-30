import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST as approve } from '../app/api/v1/auth/approve/route';
import { resetStoreCacheForTests } from '../src/data/store';
import { ACCOUNT_POLICY_VERSION } from '../src/lib/accountConsent';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
/** Every request the route made to Supabase, as "METHOD path". */
let requests: string[] = [];
let consentRows: unknown[] = [];
let consentsTableFails = false;
/** Session tokens are uuids (approve_device_code mints them with gen_random_uuid()). */
const SESSION_TOKEN = '6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f';

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
    if (url.pathname === '/auth/v1/user') return Response.json({ id: '00000000-0000-4000-8000-000000000001', email: 'person@example.com', user_metadata: {} });
    if (url.pathname === '/rest/v1/rpc/approve_device_code') return Response.json(SESSION_TOKEN);
    if (url.pathname === '/rest/v1/consents') {
      if (consentsTableFails) return Response.json({ message: 'relation "public.consents" does not exist' }, { status: 404 });
      consentRows.push(...(await request.json()));
      return new Response(null, { status: 201 });
    }
    if (url.pathname === '/rest/v1/tokens' && request.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ message: `unexpected ${url.pathname}` }, { status: 500 });
  };
});
afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
  resetStoreCacheForTests();
});

function call(agreement: unknown): Promise<Response> {
  return approve(new Request('https://api.example.test/api/v1/auth/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer supabase-access-token' },
    body: JSON.stringify({ userCode: 'ABCDEF0123456789', ...(agreement === undefined ? {} : { agreement }) }),
  }));
}

const both = { terms: true, age18: true, policyVersion: ACCOUNT_POLICY_VERSION };

for (const [name, agreement] of [
  ['no agreement', undefined],
  ['Terms only', { terms: true, age18: false, policyVersion: ACCOUNT_POLICY_VERSION }],
  ['18+ only', { terms: false, age18: true, policyVersion: ACCOUNT_POLICY_VERSION }],
  ['the string "true"', { terms: 'true', age18: 'true', policyVersion: ACCOUNT_POLICY_VERSION }],
  ['an older policy version', { terms: true, age18: true, policyVersion: '2026-01-01' }],
  ['no policy version', { terms: true, age18: true }],
] as const) {
  test(`approve refuses ${name} before signing anything in`, async () => {
    const response = await call(agreement);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(requests, [], 'no Supabase request: no session checked, no device approved');
  });
}

test('both boxes sign the app in; with the consents table off nothing is written to it', async () => {
  const response = await call(both);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') ?? '', new RegExp(`^uncode_session=${SESSION_TOKEN};`));
  assert.ok(requests.includes('POST /rest/v1/rpc/approve_device_code'));
  assert.equal(requests.filter((r) => r.includes('/consents')).length, 0);
});

test('with CONSENTS_TABLE=on the account gets one row per box, with the version and time', async () => {
  process.env.CONSENTS_TABLE = 'on';
  const before = Date.now();
  const response = await call(both);
  assert.equal(response.status, 200);
  const rows = consentRows as Array<{ user_id: string; kind: string; policy_version: string; agreed_at: string }>;
  assert.deepEqual(rows.map((r) => [r.user_id, r.kind, r.policy_version]), [
    ['00000000-0000-4000-8000-000000000001', 'terms', ACCOUNT_POLICY_VERSION],
    ['00000000-0000-4000-8000-000000000001', 'age_18', ACCOUNT_POLICY_VERSION],
  ]);
  for (const row of rows) assert.ok(Date.parse(row.agreed_at) >= before - 1000);
});

test('when the agreement cannot be stored the new session is withdrawn and no cookie is set', async () => {
  process.env.CONSENTS_TABLE = 'on';
  consentsTableFails = true;
  const response = await call(both);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.ok(requests.includes('DELETE /rest/v1/tokens'), 'the token minted by the approve is deleted');
});
