import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as approveRoute } from '../app/api/v1/auth/approve/route';

// The desktop app's sign-in is approved here, so this is where an invited teammate's seat attaches.
// Against a fake Supabase (fetch replaced; no network, no database): the real route and both real stores.
process.env.SUPABASE_URL = 'https://invite-on-sign-in.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests-only';

const USER_ID = '2f6c9a1e-3b4d-4e5f-8a9b-0c1d2e3f4a5b';
const WORKSPACE_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
const signedInUser = { id: USER_ID, email: 'member@team.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };

function fakeSupabase(acceptPending: () => Response): { calls: Array<{ path: string; body: unknown }>; restore: () => void } {
  const calls: Array<{ path: string; body: unknown }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    const text = request.method === 'GET' ? '' : await request.text();
    calls.push({ path: `${request.method} ${path}`, body: text ? JSON.parse(text) : null });
    if (path === '/auth/v1/user') return Response.json(signedInUser);
    if (path === '/rest/v1/account_deletions') return Response.json([]);
    if (path === '/rest/v1/rpc/approve_device_code') return Response.json('session-token-for-tests');
    if (path === '/rest/v1/rpc/accept_pending_invitations') return acceptPending();
    if (path === '/rest/v1/billing_audit_log') return new Response(null, { status: 201 });
    return Response.json({ message: 'unexpected' }, { status: 500 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function approve(): Promise<Response> {
  return approveRoute(new Request('https://api.example.test/api/v1/auth/approve', {
    method: 'POST', headers: { authorization: 'Bearer valid-access-token', 'content-type': 'application/json' }, body: JSON.stringify({ userCode: 'ABCDEF0123456789' }),
  }));
}

test('approving a sign-in accepts the pending invitations for that user, after the device is approved, and audits each join', async () => {
  const fake = fakeSupabase(() => Response.json([WORKSPACE_ID]));
  try {
    const res = await approve();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie') ?? '', /^uncode_session=session-token-for-tests;/);
    const paths = fake.calls.map((call) => call.path);
    // The users row (with the verified email) is written by approve_device_code, which must run first.
    assert.ok(paths.indexOf('POST /rest/v1/rpc/approve_device_code') < paths.indexOf('POST /rest/v1/rpc/accept_pending_invitations'));
    assert.deepEqual(fake.calls.find((call) => call.path === 'POST /rest/v1/rpc/accept_pending_invitations')?.body, { p_user_id: USER_ID });
    const audit = fake.calls.find((call) => call.path === 'POST /rest/v1/billing_audit_log')?.body as Record<string, unknown> | undefined;
    assert.equal(audit?.workspace_id, WORKSPACE_ID);
    assert.equal(audit?.action, 'invitation.accepted');
  } finally {
    fake.restore();
  }
});

test('a failure while accepting invitations never blocks the sign-in', async () => {
  const fake = fakeSupabase(() => Response.json({ message: 'database unavailable' }, { status: 500 }));
  const quiet = console.error;
  console.error = () => undefined;
  try {
    const res = await approve();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie') ?? '', /^uncode_session=/);
    assert.equal(fake.calls.some((call) => call.path === 'POST /rest/v1/billing_audit_log'), false);
  } finally {
    console.error = quiet;
    fake.restore();
  }
});
