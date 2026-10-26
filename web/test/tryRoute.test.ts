import { createHash, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { POST } from '../app/api/v1/try/route';

// The real /api/v1/try handler; only the AI providers and PostgREST HTTP boundaries are local.
const BASE_ENV = { ...process.env };
const STORE_HOST = 'try.supabase.test';

type Row = { ip_hash: string; created_at: string };
const calls = { gemini: 0, openrouter: 0, anthropic: 0 };
let rows: Row[] = [];
let inserted: unknown[] = [];
/**
 * `count`: counts answer 500; `missing`: no table (PostgREST answers a head request 404, no body);
 * `day-missing`: only the unfiltered (daily) count answers 404 with no body, so it has no count while the per-IP count is fine;
 * `insert`: inserts answer 500.
 */
let fault: 'count' | 'missing' | 'day-missing' | 'insert' | null = null;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'generativelanguage.googleapis.com') {
    calls.gemini += 1;
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Gemini says it adds one.' }] } }] });
  }
  if (url.hostname === 'openrouter.ai') {
    calls.openrouter += 1;
    return Response.json({ choices: [{ message: { content: 'OpenRouter answer.' } }] });
  }
  if (url.hostname === 'api.anthropic.com') {
    calls.anthropic += 1;
    return Response.json({ content: [{ type: 'text', text: 'Anthropic answer.' }] });
  }
  if (url.hostname === STORE_HOST && url.pathname === '/rest/v1/try_requests') return store(url, init);
  throw new Error(`Unexpected request: ${url}`);
}) as typeof fetch;

/** PostgREST for `try_requests`: head counts with `ip_hash=eq.` / `created_at=gte.` filters, and inserts. */
async function store(url: URL, init?: RequestInit): Promise<Response> {
  const method = init?.method ?? 'GET';
  if (method === 'POST') {
    if (fault === 'insert') return Response.json({ code: 'XX000', message: 'insert failed' }, { status: 500 });
    const body: unknown = JSON.parse(String(init?.body));
    inserted.push(body);
    const ipHash = body && typeof body === 'object' && 'ip_hash' in body ? String(body.ip_hash) : '';
    rows.push({ ip_hash: ipHash, created_at: new Date().toISOString() });
    return new Response(null, { status: 201 });
  }
  if (fault === 'count') return Response.json({ code: 'XX000', message: 'count failed' }, { status: 500 });
  if (fault === 'missing') return new Response(null, { status: 404 });
  if (fault === 'day-missing' && !url.searchParams.has('ip_hash')) return new Response(null, { status: 404 });
  const ip = url.searchParams.get('ip_hash')?.replace(/^eq\./, '');
  const since = url.searchParams.get('created_at')?.replace(/^gte\./, '') ?? '';
  const count = rows.filter((row) => (!ip || row.ip_hash === ip) && row.created_at >= since).length;
  return new Response(null, { status: 200, headers: { 'content-range': `*/${count}` } });
}

function setEnv(vars: Record<string, string | undefined>): void {
  const env = process.env as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
}

/** Production with the store configured and only a Gemini key, like api.unvibe.site. */
function production(extra: Record<string, string | undefined> = {}): void {
  setEnv({
    NODE_ENV: 'production',
    GEMINI_API_KEY: 'local-gemini-key',
    SUPABASE_URL: `https://${STORE_HOST}`,
    SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
    ...extra,
  });
}

let ipSeq = 0;
function tryRequest(ip = `198.51.100.${++ipSeq % 250}`): Request {
  return new Request('http://localhost/api/v1/try', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ code: 'const a = 1 + 1;', level: 'beginner' }),
  });
}

beforeEach(() => {
  process.env = { ...BASE_ENV };
  setEnv({
    NODE_ENV: undefined,
    ENABLE_MOCK_AI: undefined,
    OPENROUTER_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
    GOOGLE_API_KEY: undefined,
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    TRY_IP_SALT: undefined,
  });
  calls.gemini = 0;
  calls.openrouter = 0;
  calls.anthropic = 0;
  rows = [];
  inserted = [];
  fault = null;
  delete (globalThis as { __unvibeTryMemory?: unknown }).__unvibeTryMemory;
});

test('Try uses Gemini even when OpenRouter and Anthropic keys are set too', async () => {
  production({ OPENROUTER_API_KEY: 'local-openrouter-key', ANTHROPIC_API_KEY: 'local-anthropic-key' });
  const res = await POST(tryRequest());
  assert.equal(res.status, 200);
  assert.match(await res.text(), /"text":"Gemini says it adds one\."/);
  assert.deepEqual(calls, { gemini: 1, openrouter: 0, anthropic: 0 });
});

test('Try in production with only an OpenRouter key answers 503 and calls no model', async () => {
  production({ GEMINI_API_KEY: undefined, OPENROUTER_API_KEY: 'local-openrouter-key' });
  const res = await POST(tryRequest());
  assert.equal(res.status, 503);
  assert.deepEqual(calls, { gemini: 0, openrouter: 0, anthropic: 0 });
});

test('Try in production ignores ENABLE_MOCK_AI: no Gemini key is 503, a Gemini key answers', async () => {
  production({ GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: 'local-anthropic-key', ENABLE_MOCK_AI: 'true' });
  assert.equal((await POST(tryRequest())).status, 503);
  setEnv({ GEMINI_API_KEY: 'local-gemini-key' });
  assert.equal((await POST(tryRequest())).status, 200);
  assert.deepEqual(calls, { gemini: 1, openrouter: 0, anthropic: 0 });
});

test('outside production ENABLE_MOCK_AI selects the labelled mock, which Try never shows as an answer', async () => {
  setEnv({ ENABLE_MOCK_AI: 'true', GEMINI_API_KEY: 'local-gemini-key' });
  assert.equal((await POST(tryRequest())).status, 503);
  assert.deepEqual(calls, { gemini: 0, openrouter: 0, anthropic: 0 });
});

function storedHash(): string {
  const last = inserted.at(-1);
  assert.ok(last && typeof last === 'object' && 'ip_hash' in last && typeof last.ip_hash === 'string', 'Try stored one row');
  return last.ip_hash;
}

test('the stored IP hash is an HMAC keyed by the service-role key, not sha256 of a public constant', async () => {
  production();
  const ip = '203.0.113.7';
  assert.equal((await POST(tryRequest(ip))).status, 200);
  const stored = storedHash();
  assert.notEqual(stored, createHash('sha256').update(`unvibe-try:${ip}`).digest('hex').slice(0, 32));
  assert.equal(stored, createHmac('sha256', 'local-service-role-key').update(`unvibe-try:${ip}`).digest('hex').slice(0, 32));
});

test('the same IP hashes differently under different keys, and TRY_IP_SALT wins over the service-role key', async () => {
  const ip = '203.0.113.8';
  const hashes: string[] = [];
  for (const salt of ['local-try-salt-one', 'local-try-salt-two', undefined]) {
    production({ TRY_IP_SALT: salt });
    assert.equal((await POST(tryRequest(ip))).status, 200);
    hashes.push(storedHash());
  }
  assert.equal(new Set(hashes).size, 3);
  assert.equal(hashes[0], createHmac('sha256', 'local-try-salt-one').update(`unvibe-try:${ip}`).digest('hex').slice(0, 32));
});

test('production with neither TRY_IP_SALT nor the service-role key answers 503 and calls no model', async () => {
  production({ SUPABASE_SERVICE_ROLE_KEY: undefined, TRY_IP_SALT: undefined });
  const res = await POST(tryRequest());
  assert.equal(res.status, 503);
  assert.equal(calls.gemini, 0);
  assert.equal(inserted.length, 0);
});

test('a store count error answers 503 with zero model calls', async () => {
  production();
  fault = 'count';
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(calls.gemini, 0);
  assert.equal(inserted.length, 0);
});

test('a missing try_requests table (head count with no count) answers 503 with zero model calls', async () => {
  production();
  fault = 'missing';
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(calls.gemini, 0);
});

test('only the daily count failing (per-IP count fine) answers 503 with zero model calls', async () => {
  production();
  fault = 'day-missing';
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(calls.gemini, 0);
  assert.equal(inserted.length, 0);
});

test('a store insert error answers 503 with zero model calls', async () => {
  production();
  fault = 'insert';
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(calls.gemini, 0);
});

test('a limiter that throws (malformed SUPABASE_URL) answers 503 with zero model calls', async () => {
  production({ SUPABASE_URL: 'not a url' });
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(calls.gemini, 0);
});

test('the store caps one IP at 6 an hour and everyone at 500 a day', async () => {
  production();
  const ip = '203.0.113.9';
  for (let i = 0; i < 6; i += 1) assert.equal((await POST(tryRequest(ip))).status, 200);
  assert.equal((await POST(tryRequest(ip))).status, 429);
  const now = new Date().toISOString();
  while (rows.length < 500) rows.push({ ip_hash: `other-${rows.length}`, created_at: now });
  assert.equal((await POST(tryRequest())).status, 429);
  assert.equal(calls.gemini, 6);
});

test('production without a store answers 503 instead of using process memory', async () => {
  production({ SUPABASE_URL: undefined });
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(calls.gemini, 0);
});

test('outside production the memory fallback stops one IP at 6 an hour and everyone at 500 a day', async () => {
  setEnv({ GEMINI_API_KEY: 'local-gemini-key' });
  const ip = '203.0.113.10';
  for (let i = 0; i < 6; i += 1) assert.equal((await POST(tryRequest(ip))).status, 200);
  assert.equal((await POST(tryRequest(ip))).status, 429);
  for (let i = 6; i < 500; i += 1) {
    assert.equal((await POST(tryRequest(`10.0.${i >> 8}.${i & 255}`))).status, 200);
  }
  const res = await POST(tryRequest('10.9.9.9'));
  assert.equal(res.status, 429);
  assert.match(await res.text(), /busy today/);
  assert.equal(calls.gemini, 500);
});
