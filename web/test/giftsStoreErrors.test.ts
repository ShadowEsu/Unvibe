import assert from 'node:assert/strict';
import test from 'node:test';
import { POST as claimRoute } from '../app/api/v1/gifts/claim/route';
import { GET as mineRoute } from '../app/api/v1/gifts/mine/route';

// Real routes and the real Supabase gift backend; only the PostgREST HTTP boundary is local.
process.env.SUPABASE_URL = 'https://gifts-store-errors.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
process.env.GIFT_CODE_SECRET = 'test-gift-secret-0123456789abcdefghijklmnop';

const USER_ID = '00000000-0000-4000-8000-000000000001';
// What PostgREST returns when a grant or table is wrong: table names, roles, hints.
const STORE_DETAIL = 'permission denied for table gift_codes';

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const accept = new Headers(init?.headers).get('accept') ?? '';
  const row = (value: Record<string, unknown>) => Response.json(accept.includes('vnd.pgrst.object') ? value : [value]);
  if (url.pathname === '/rest/v1/tokens') return row({ user_id: USER_ID });
  if (url.pathname === '/rest/v1/users') return row({ email: 'giver@gift.test', settings: {} });
  if (url.pathname.startsWith('/rest/v1/gift_') || url.pathname === '/rest/v1/rpc/claim_gift') {
    return Response.json({ code: '42501', message: STORE_DETAIL, hint: 'Grant usage to service_role.', details: null }, { status: 403 });
  }
  throw new Error(`Unexpected request: ${url.pathname}`);
}) as typeof fetch;

/** Calls a route with console.error captured; returns the JSON body and everything logged. */
async function withLogs(call: () => Promise<Response>): Promise<{ status: number; body: Record<string, unknown>; logged: string }> {
  const logs: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logs.push(args); };
  try {
    const response = await call();
    const body = await response.json() as Record<string, unknown>;
    const logged = logs.map((args) => args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ')).join('\n');
    return { status: response.status, body, logged };
  } finally {
    console.error = original;
  }
}

test('a gift store error on Share returns a plain 503, and the detail stays in the server log', async () => {
  const { status, body, logged } = await withLogs(() => mineRoute(new Request('https://api.example.test/api/v1/gifts/mine', {
    headers: { authorization: 'Bearer session-token' },
  })));
  assert.equal(status, 503);
  assert.equal(body.error, 'gift_error');
  assert.equal(body.message, 'Gift details could not load.');
  assert.ok(!JSON.stringify(body).includes('gift_codes'), 'store detail must not reach the client');
  assert.match(logged, /permission denied for table gift_codes/);
});

test('a gift store error on claim returns a plain 503, and the detail stays in the server log', async () => {
  const { status, body, logged } = await withLogs(() => claimRoute(new Request('https://api.example.test/api/v1/gifts/claim', {
    method: 'POST',
    headers: { authorization: 'Bearer session-token', 'content-type': 'application/json', 'x-forwarded-for': '10.9.0.1' },
    body: JSON.stringify({ code: 'Ab3_x-9QzLmN0pR7' }),
  })));
  assert.equal(status, 503);
  assert.equal(body.error, 'gift_error');
  assert.equal(body.message, 'The gift could not be claimed. Try again shortly.');
  assert.ok(!JSON.stringify(body).includes('gift_codes'), 'store detail must not reach the client');
  assert.match(logged, /permission denied for table gift_codes/);
});
