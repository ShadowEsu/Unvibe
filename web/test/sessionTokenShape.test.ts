import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { GET as profile } from '../app/api/v1/profile/route';
import { resetStoreCacheForTests } from '../src/data/store';
import { SupabaseStore } from '../src/data/supabaseStore';

// Security U-N1 (2026-10-29): tokens.token is a uuid column, so a bearer or cookie that isn't a
// UUID made Postgres reject the lookup and the route answered 500. PostgREST is stubbed the way it
// answers for real: 400 / 22P02 on a malformed uuid, an empty result for an unknown one.
function postgrest(requests: string[]): typeof fetch {
  return async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.pathname);
    const token = url.searchParams.get('token')?.replace(/^eq\./, '') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return new Response(JSON.stringify({ code: '22P02', message: `invalid input syntax for type uuid: "${token}"` }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
  resetStoreCacheForTests();
});

test('a session token that is not a UUID never reaches the tokens table', async () => {
  const requests: string[] = [];
  const store = new SupabaseStore('https://example.test', 'service-key', postgrest(requests));
  for (const token of ['not-a-uuid', "x' or 1=1", '0'.repeat(36), `${crypto.randomUUID()} `]) {
    assert.equal(await store.userForToken(token), null, token);
    await store.revokeToken(token);
  }
  assert.deepEqual(requests, []);
  // A well-formed token is still looked up.
  assert.equal(await store.userForToken(crypto.randomUUID()), null);
  assert.equal(requests.length, 1);
});

test('a non-UUID bearer or session cookie is a 401, not a 500', async () => {
  Object.assign(process.env, { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key' });
  const requests: string[] = [];
  globalThis.fetch = postgrest(requests);
  resetStoreCacheForTests();
  const cases: Array<Record<string, string>> = [{ authorization: 'Bearer not-a-uuid' }, { cookie: 'uncode_session=not-a-uuid' }];
  for (const headers of cases) {
    const response = await profile(new Request('http://localhost/api/v1/profile', { headers }));
    assert.equal(response.status, 401, JSON.stringify(headers));
  }
  assert.deepEqual(requests, []);
});
