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
    const body: unknown = JSON.parse(String(init?.body));
    inserted.push(body);
    const ipHash = body && typeof body === 'object' && 'ip_hash' in body ? String(body.ip_hash) : '';
    rows.push({ ip_hash: ipHash, created_at: new Date().toISOString() });
    return new Response(null, { status: 201 });
  }
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
