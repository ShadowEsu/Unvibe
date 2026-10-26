import assert from 'node:assert/strict';
import test from 'node:test';
import { POST as redeemRoute } from '../app/api/v1/promo/redeem/route';
import { normalisePromoCode, promoCodeHash } from '../src/lib/promoCode';

// The Supabase backend against a fake Supabase (fetch is replaced; no network, no database):
// the access token is checked with Supabase Auth, users is upserted, and the RPC gets only the
// hash. The SQL itself is tested in ~/unvibe-e2e/promo/sqltest/run.mjs.
const URL_BASE = 'https://fake-project.supabase.test';
const SERVICE_KEY = 'service-role-key-for-tests-only';
process.env.SUPABASE_URL = URL_BASE;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;

const USER_ID = '6f1c1a1e-3b7e-4a43-9a51-6f0d7c0e2b11';
const GOOD_TOKEN = 'supabase-access-token-good';

interface Seen { method: string; path: string; auth: string | null; apikey: string | null; body: unknown }

function fakeSupabase(rpcRow: Record<string, unknown>, deletion?: Record<string, unknown>): { seen: Seen[]; restore: () => void } {
  const seen: Seen[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    seen.push({
      method: request.method, path: `${url.pathname}${url.search}`, auth: request.headers.get('authorization'),
      apikey: request.headers.get('apikey'), body: text ? JSON.parse(text) : null,
    });
    if (url.pathname === '/auth/v1/user') {
      return request.headers.get('authorization') === `Bearer ${GOOD_TOKEN}`
        ? Response.json({ id: USER_ID, email: 'hacker@school.edu', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
        : Response.json({ code: 401, msg: 'invalid JWT' }, { status: 401 });
    }
    // An account being deleted has an account_deletions row; none here unless the test sets one.
    if (url.pathname === '/rest/v1/account_deletions') return Response.json(deletion ? [deletion] : []);
    if (url.pathname === '/rest/v1/users') return new Response(null, { status: 201 });
    if (url.pathname === '/rest/v1/rpc/redeem_promo_code') return Response.json([rpcRow]);
    return Response.json({ message: 'unexpected' }, { status: 500 });
  };
  return { seen, restore: () => { globalThis.fetch = original; } };
}

function redeem(body: unknown): Promise<Response> {
  return redeemRoute(new Request('https://api.example.test/api/v1/promo/redeem', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.7.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body),
  }));
}

test('supabase: token checked with Supabase Auth, users upserted, RPC gets only the hash', async () => {
  const code = 'ABCD-EFGH-JKMN-PQRS';
  const proUntil = '2027-01-24T02:00:00+00:00';
  const fake = fakeSupabase({ status: 'redeemed', months: 3, pro_until: proUntil });
  try {
    const res = await redeem({ accessToken: GOOD_TOKEN, code });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, status: 'redeemed', months: 3, proUntil, message: 'Pro months added.' });
    assert.deepEqual(fake.seen.map((s) => `${s.method} ${s.path.split('?')[0]}`), [
      'GET /auth/v1/user', 'GET /rest/v1/account_deletions', 'POST /rest/v1/users', 'POST /rest/v1/rpc/redeem_promo_code',
    ]);
    const [auth, , users, rpc] = fake.seen;
    assert.equal(auth.auth, `Bearer ${GOOD_TOKEN}`);
    assert.ok(users.path.includes('on_conflict=id'));
    assert.deepEqual(users.body, { id: USER_ID, email: 'hacker@school.edu' });
    assert.equal(rpc.apikey, SERVICE_KEY);
    const normalised = normalisePromoCode(code);
    assert.ok(normalised);
    assert.deepEqual(rpc.body, { p_user_id: USER_ID, p_code_hash: promoCodeHash(normalised) });
    assert.ok(!JSON.stringify(fake.seen).includes(normalised), 'the code itself never leaves the API');
  } finally {
    fake.restore();
  }
});

test('supabase: a token Supabase Auth rejects is 401 and nothing else is called', async () => {
  const fake = fakeSupabase({ status: 'redeemed', months: 3, pro_until: null });
  try {
    const res = await redeem({ accessToken: 'forged', code: 'ABCD-EFGH-JKMN-PQRS' });
    assert.equal(res.status, 401);
    assert.deepEqual(fake.seen.map((s) => s.path), ['/auth/v1/user']);
  } finally {
    fake.restore();
  }
});

test('supabase: while the account is being deleted, redeem answers 410 and never upserts the user', async () => {
  const fake = fakeSupabase({ status: 'redeemed', months: 3, pro_until: null }, { user_id: USER_ID, state: 'started', step: 'auth_identity', email: 'leaving@account.test' });
  try {
    const res = await redeem({ accessToken: GOOD_TOKEN, code: 'ABCD-EFGH-JKMN-PQRS' });
    assert.equal(res.status, 410);
    assert.equal((await res.json() as { error?: string }).error, 'account_deleted');
    assert.deepEqual(fake.seen.map((s) => `${s.method} ${s.path.split('?')[0]}`), ['GET /auth/v1/user', 'GET /rest/v1/account_deletions']);
  } finally {
    fake.restore();
  }
});

test('supabase: each RPC status maps to its HTTP status', async () => {
  const expected: Array<[string, number]> = [
    ['already_yours', 200], ['invalid', 404], ['used', 409], ['one_per_account', 409], ['has_paid_plan', 409],
    ['expired', 410], ['cap_reached', 410],
  ];
  for (const [status, http] of expected) {
    const fake = fakeSupabase({ status, months: status === 'already_yours' ? 3 : null, pro_until: null });
    try {
      const res = await redeem({ accessToken: GOOD_TOKEN, code: 'ABCD-EFGH-JKMN-PQRS' });
      assert.equal(res.status, http, status);
      const body = await res.json() as { status?: string; error?: string };
      assert.equal(body.status ?? body.error, status);
    } finally {
      fake.restore();
    }
  }
  const odd = fakeSupabase({ status: 'surprise' });
  try {
    assert.equal((await redeem({ accessToken: GOOD_TOKEN, code: 'ABCD-EFGH-JKMN-PQRS' })).status, 503);
  } finally {
    odd.restore();
  }
});
