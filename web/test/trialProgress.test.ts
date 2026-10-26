import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST } from '../app/api/v1/trial/progress/route';
import { trialInstallKey } from '../src/lib/trialAccess';

// The real route runs; only the Supabase HTTP boundary is local (instrumentation spec 11.1).
const TOKEN = 'local-trial-token-abcdefghijklmnop';
const PREV = { ...process.env };
const previousFetch = globalThis.fetch;

interface Upsert {
  body: Record<string, unknown>;
  prefer: string;
}

let installs: Set<string>;
let upserts: Upsert[];
let rateLimitFull: boolean;
let kindCheckRejects: boolean;
let rateLimitCalls: number;

beforeEach(() => {
  process.env.UNVIBE_TRIAL_TOKEN = TOKEN;
  process.env.SUPABASE_URL = 'https://progress.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  installs = new Set();
  upserts = [];
  rateLimitFull = false;
  kindCheckRejects = false;
  rateLimitCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/trial_reserve') {
      rateLimitCalls += 1;
      const body = JSON.parse(String(init?.body)) as { p_install_key: string };
      assert.match(body.p_install_key, /^__progress_ip__:\d{4}-\d{2}-\d{2}:[0-9a-f]{32}$/, 'the per-network key never holds the address');
      return Response.json(rateLimitFull ? -1 : 1);
    }
    if (url.pathname === '/rest/v1/trial_installs') {
      assert.equal(init?.method ?? 'GET', 'GET', 'a progress ping never creates an install row');
      const key = url.searchParams.get('install_key')?.replace(/^eq\./, '') ?? '';
      return Response.json(installs.has(key) ? [{ install_key: key }] : []);
    }
    if (url.pathname === '/rest/v1/trial_activation') {
      const headers = new Headers(init?.headers);
      if (kindCheckRejects) {
        return Response.json({ code: '23514', message: 'new row for relation "trial_activation" violates check constraint "trial_activation_kind_check"' }, { status: 400 });
      }
      upserts.push({ body: JSON.parse(String(init?.body)) as Record<string, unknown>, prefer: headers.get('prefer') ?? '' });
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  process.env = { ...PREV };
});

const ping = (installId: string, body: unknown, headers: Record<string, string> = {}) => POST(new Request('http://localhost/api/v1/trial/progress', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${TOKEN}`,
    'x-unvibe-install-id': installId,
    'content-type': 'application/json',
    'x-forwarded-for': '198.51.100.20',
    ...headers,
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));

test('401 without the trial token, with a wrong token, or with a bad install ID', async () => {
  const noToken = await POST(new Request('http://localhost/api/v1/trial/progress', {
    method: 'POST', headers: { 'x-unvibe-install-id': 'progress-install-401' }, body: '{"step":"onboarded"}',
  }));
  assert.equal(noToken.status, 401);
  assert.equal((await ping('progress-install-401', { step: 'onboarded' }, { authorization: 'Bearer wrong-token-abcdefghijklmnopqrs' })).status, 401);
  assert.equal((await ping('bad id!', { step: 'onboarded' })).status, 401);
  assert.equal(upserts.length, 0);
});

test('stores one write-once marker; a repeat is a no-op', async () => {
  const id = 'progress-install-once';
  installs.add(trialInstallKey(id));
  const first = await ping(id, { step: 'onboarded' });
  assert.equal(first.status, 204);
  assert.equal(upserts.length, 1);
  assert.match(upserts[0]!.prefer, /resolution=ignore-duplicates/, 'the database keeps the first row');
  assert.equal(upserts[0]!.body.kind, 'onboarded');
  assert.equal(upserts[0]!.body.install_key, trialInstallKey(id));

  const repeat = await ping(id, { step: 'onboarded' });
  assert.equal(repeat.status, 204);
  assert.equal(upserts.length, 1, 'a duplicate ping writes nothing new');
});

test('every app-reported kind is accepted', async () => {
  const id = 'progress-install-kinds';
  installs.add(trialInstallKey(id));
  const kinds = ['onboarded', 'accessibility', 'signed_in', 'accessibility_asked', 'level_answered', 'login_prompt_shown', 'login_prompt_accepted'];
  for (const step of kinds) assert.equal((await ping(id, { step })).status, 204, step);
  assert.deepEqual(upserts.map((u) => u.body.kind), kinds);
});

test('400 for a missing or unknown step, including server-only kinds', async () => {
  const id = 'progress-install-400';
  installs.add(trialInstallKey(id));
  for (const body of [{}, { step: 'deleted_everything' }, { step: 'return' }, { step: 'code' }, { step: 7 }, 'not json', 'null']) {
    assert.equal((await ping(id, body)).status, 400, JSON.stringify(body));
  }
  assert.equal(upserts.length, 0);
});

test('413 over 256 bytes', async () => {
  const id = 'progress-install-413';
  installs.add(trialInstallKey(id));
  const response = await ping(id, { step: 'onboarded', pad: 'x'.repeat(300) });
  assert.equal(response.status, 413);
  assert.equal(upserts.length, 0);
});

test('no PII: extra body fields are never stored', async () => {
  const id = 'progress-install-pii';
  installs.add(trialInstallKey(id));
  const response = await ping(id, { step: 'accessibility', code: 'const secret = 1', path: '/Users/me/a.ts', email: 'me@example.com' });
  assert.equal(response.status, 204);
  assert.deepEqual(Object.keys(upserts[0]!.body).sort(), ['at', 'install_key', 'kind']);
  const stored = JSON.stringify(upserts[0]!.body);
  for (const leak of ['secret', '/Users', 'example.com', '198.51.100.20', id]) assert.equal(stored.includes(leak), false, leak);
});

test('409 and no write when the install has no trial_installs row', async () => {
  const response = await ping('progress-install-missing', { step: 'onboarded' });
  assert.equal(response.status, 409);
  assert.equal(upserts.length, 0);
});

test('signed_in keeps only the UTC day', async () => {
  const id = 'progress-install-day';
  installs.add(trialInstallKey(id));
  assert.equal((await ping(id, { step: 'signed_in' })).status, 204);
  assert.match(String(upserts[0]!.body.at), /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
});

test('rate limited per network like the trial AI routes', async () => {
  const id = 'progress-install-429';
  installs.add(trialInstallKey(id));
  rateLimitFull = true;
  const response = await ping(id, { step: 'onboarded' });
  assert.equal(response.status, 429);
  assert.equal(rateLimitCalls, 1);
  assert.equal(upserts.length, 0);
});

test('before the funnel migration allows the kind, 503 so the app retries, then stored once it is applied', async () => {
  const id = 'progress-install-premigration';
  installs.add(trialInstallKey(id));
  kindCheckRejects = true;
  assert.equal((await ping(id, { step: 'onboarded' })).status, 503);
  kindCheckRejects = false;
  assert.equal((await ping(id, { step: 'onboarded' })).status, 204);
  assert.equal(upserts.length, 1);
});
