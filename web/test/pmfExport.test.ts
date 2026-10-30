import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { GET } from '../app/api/v1/admin/pmf-export/route';

// The real route runs; only the Supabase HTTP boundary is local.
const ADMIN = 'a'.repeat(32);
const PREV = { ...process.env };
const previousFetch = globalThis.fetch;
const KEY = 'b'.repeat(64);

let reads: number;
let stored: Array<Record<string, unknown>>;
let since: string | null;

beforeEach(() => {
  process.env.UNVIBE_ADMIN_STATS_TOKEN = ADMIN;
  process.env.SUPABASE_URL = 'https://pmf-export.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  reads = 0;
  since = null;
  stored = [
    { install_key: KEY, created_at: '2026-10-31T23:59:59.000Z', q1: 'very', q2: 'Bootcamp students', q3: 'Plain answers', q4: 'Windows', app_version: '0.1.47' },
    { install_key: KEY.replace(/b/g, 'c'), created_at: '2026-11-01T00:00:01+00:00', q1: 'na', q2: '', q3: '', q4: '', app_version: '0.1.48' },
  ];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(init?.method ?? 'GET', 'GET', 'the export never writes');
    if (url.pathname === '/rest/v1/pmf_responses') {
      reads += 1;
      since = url.searchParams.get('created_at');
      return Response.json(stored);
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  process.env = { ...PREV };
});

const get = (auth?: string) => GET(new Request('https://api.test/api/v1/admin/pmf-export', { headers: auth ? { authorization: auth } : {} }));

test('401 without the admin token, with a wrong one, or when none is configured; nothing is read', async () => {
  assert.equal((await get()).status, 401);
  assert.equal((await get(`Bearer ${ADMIN}x`)).status, 401);
  assert.equal((await get('Bearer local-trial-token-abcdefghijklmnop')).status, 401);
  delete process.env.UNVIBE_ADMIN_STATS_TOKEN;
  assert.equal((await get(`Bearer ${ADMIN}`)).status, 401);
  assert.equal(reads, 0);
});

test('returns the scorer rows with the UTC date and no other fields, only from the last 12 months', async () => {
  const response = await get(`Bearer ${ADMIN}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), [
    { install_key: KEY, date: '2026-10-31', q1: 'very', q2: 'Bootcamp students', q3: 'Plain answers', q4: 'Windows', app_version: '0.1.47' },
    { install_key: KEY.replace(/b/g, 'c'), date: '2026-11-01', q1: 'na', q2: '', q3: '', q4: '', app_version: '0.1.48' },
  ]);
  const cutoff = Date.parse(String(since).replace(/^gte\./, ''));
  const yearAgo = new Date();
  yearAgo.setUTCMonth(yearAgo.getUTCMonth() - 12);
  assert.ok(Math.abs(cutoff - yearAgo.getTime()) < 60_000, `the read is bounded to the retention period (${since})`);
});

test('503 when storage fails', async () => {
  globalThis.fetch = (async () => Response.json({ code: '42P01', message: 'relation does not exist' }, { status: 404 })) as typeof fetch;
  const previousError = console.error;
  console.error = () => undefined;
  try {
    assert.equal((await get(`Bearer ${ADMIN}`)).status, 503);
  } finally {
    console.error = previousError;
  }
});
