import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as approveRoute } from '../app/api/v1/auth/approve/route';

// Device approval takes a Supabase access token. Against a fake Supabase (fetch replaced; no
// network, no database): the real route, supabase-js client and SupabaseStore.
process.env.SUPABASE_URL = 'https://deletion-sessions.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests-only';

const USER_ID = '7d3c0e0a-52b4-4c1e-9f5a-1b2c3d4e5f60';
const signedInUser = { id: USER_ID, email: 'leaving@account.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };

function fakeSupabase(route: (url: URL) => Response): { seen: string[]; restore: () => void } {
  const seen: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    seen.push(`${request.method} ${url.pathname}`);
    return route(url);
  }) as typeof fetch;
  return { seen, restore: () => { globalThis.fetch = original; } };
}

function approve(accessToken: string): Promise<Response> {
  return approveRoute(new Request('https://api.example.test/api/v1/auth/approve', {
    method: 'POST', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ userCode: 'ABCDEF0123456789' }),
  }));
}

test('device approval while the account is being deleted answers 410 and approves nothing', async () => {
  const fake = fakeSupabase((url) => {
    if (url.pathname === '/auth/v1/user') return Response.json(signedInUser);
    if (url.pathname === '/rest/v1/account_deletions') return Response.json([{ user_id: USER_ID, state: 'started', step: 'beta_downloads', email: 'leaving@account.test' }]);
    return Response.json({ message: 'unexpected' }, { status: 500 });
  });
  try {
    const res = await approve('still-valid-access-token');
    assert.equal(res.status, 410);
    assert.equal((await res.json() as { error?: string }).error, 'account_deleted');
    assert.equal(res.headers.get('set-cookie'), null, 'no session cookie');
    assert.deepEqual(fake.seen, ['GET /auth/v1/user', 'GET /rest/v1/account_deletions']);
  } finally {
    fake.restore();
  }
});

test('an access token issued before the Auth user was deleted is refused by getUser (401), and nothing else runs', async () => {
  const fake = fakeSupabase((url) => {
    // What Supabase Auth answers for a JWT whose user no longer exists.
    if (url.pathname === '/auth/v1/user') return Response.json({ code: 403, error_code: 'user_not_found', msg: 'User from sub claim in JWT does not exist' }, { status: 403 });
    return Response.json({ message: 'unexpected' }, { status: 500 });
  });
  try {
    assert.equal((await approve('stale-access-token')).status, 401);
    assert.deepEqual(fake.seen, ['GET /auth/v1/user']);
  } finally {
    fake.restore();
  }
});
