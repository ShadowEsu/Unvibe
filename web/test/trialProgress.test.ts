import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST } from '../app/api/v1/trial/progress/route';
import { installStats } from '../src/lib/adminStats';
import { sanitizeHeardFrom, trialInstallKey, trialUsageOverview } from '../src/lib/trialAccess';

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
/** trial_installs.heard_from per install key, as the database would hold it. */
let heardFrom: Map<string, string>;
let heardFromWrites: number;
let heardFromColumnMissing: boolean;

beforeEach(() => {
  process.env.UNVIBE_TRIAL_TOKEN = TOKEN;
  process.env.SUPABASE_URL = 'https://progress.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  installs = new Set();
  upserts = [];
  rateLimitFull = false;
  kindCheckRejects = false;
  rateLimitCalls = 0;
  heardFrom = new Map();
  heardFromWrites = 0;
  heardFromColumnMissing = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/trial_reserve') {
      rateLimitCalls += 1;
      const body = JSON.parse(String(init?.body)) as { p_install_key: string };
      assert.match(body.p_install_key, /^__progress_ip__:\d{4}-\d{2}-\d{2}:[0-9a-f]{32}$/, 'the per-network key never holds the address');
      return Response.json(rateLimitFull ? -1 : 1);
    }
    if (url.pathname === '/rest/v1/trial_installs') {
      const method = init?.method ?? 'GET';
      const key = url.searchParams.get('install_key')?.replace(/^eq\./, '') ?? '';
      if (method === 'PATCH') {
        if (heardFromColumnMissing) {
          return Response.json({ code: '42703', message: 'column "heard_from" of relation "trial_installs" does not exist' }, { status: 400 });
        }
        heardFromWrites += 1;
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        assert.deepEqual(Object.keys(body), ['heard_from'], 'an answer updates heard_from and nothing else');
        // PostgREST applies `heard_from=is.null` like the database would: a set answer is left alone.
        const onlyIfUnset = url.searchParams.get('heard_from') === 'is.null';
        if (installs.has(key) && (!onlyIfUnset || !heardFrom.has(key))) heardFrom.set(key, String(body.heard_from));
        return new Response(null, { status: 204 });
      }
      assert.equal(method, 'GET', 'a progress ping never creates an install row');
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

test('413 over 1 KB', async () => {
  const id = 'progress-install-413';
  installs.add(trialInstallKey(id));
  const response = await ping(id, { step: 'onboarded', pad: 'x'.repeat(1100) });
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

test('heard_from: the answer is cleaned and stored on the install row, never as a marker', async () => {
  const id = 'progress-install-heard';
  installs.add(trialInstallKey(id));
  const response = await ping(id, { step: 'heard_from', answer: '  A friend\u0000 at\n\n work\t\u202e ' });
  assert.equal(response.status, 204);
  assert.equal(heardFrom.get(trialInstallKey(id)), 'A friend at work');
  assert.equal(upserts.length, 0, 'no trial_activation row');
});

test('heard_from: sanitising drops control characters, collapses whitespace and trims', () => {
  assert.equal(sanitizeHeardFrom('  a\tsub\r\nreddit  '), 'a sub reddit');
  assert.equal(sanitizeHeardFrom('vid\u0007eo\u200b'), 'video');
  assert.equal(sanitizeHeardFrom('ok \ud800'), 'ok', 'a lone surrogate is dropped');
  for (const empty of ['', '   ', '\u0000\u0001', '\n\t', 7, null, undefined, { a: 1 }]) {
    assert.equal(sanitizeHeardFrom(empty), null, JSON.stringify(empty));
  }
});

test('heard_from: email- and phone-shaped text is removed before storing (an answer is a source, never a contact)', async () => {
  assert.equal(sanitizeHeardFrom('my friend sam.lee+x@example.co.uk told me'), 'my friend told me');
  assert.equal(sanitizeHeardFrom('call +1 (415) 555-0134 or 415.555.0134'), 'call or');
  assert.equal(sanitizeHeardFrom('sam@example.com'), null, 'nothing left: nothing stored');
  assert.equal(sanitizeHeardFrom('Product Hunt, top 5'), 'Product Hunt, top 5', 'short numbers stay');
  assert.equal(sanitizeHeardFrom('r/vibecoding @someone'), 'r/vibecoding @someone', 'a handle is not an email');
  const id = 'progress-install-heard-contact';
  installs.add(trialInstallKey(id));
  assert.equal((await ping(id, { step: 'heard_from', answer: 'A tweet by dev@example.com' })).status, 204);
  assert.equal(heardFrom.get(trialInstallKey(id)), 'A tweet by');
});

test('heard_from: the cap is 200 characters, counted as Postgres counts them', async () => {
  const id = 'progress-install-heard-cap';
  installs.add(trialInstallKey(id));
  assert.equal((await ping(id, { step: 'heard_from', answer: '\u{1F600}'.repeat(240) })).status, 204);
  const stored = heardFrom.get(trialInstallKey(id)) ?? '';
  assert.equal(Array.from(stored).length, 200, 'capped at 200 characters');
  assert.equal(stored, '\u{1F600}'.repeat(200), 'no emoji is cut in half');
  assert.equal(sanitizeHeardFrom(`${'x'.repeat(199)} tail`), `${'x'.repeat(199)}`, 'no trailing space after the cut');
});

test('heard_from: an empty answer stores nothing; the first non-empty answer wins', async () => {
  const id = 'progress-install-heard-first';
  const key = trialInstallKey(id);
  installs.add(key);
  for (const answer of ['   ', '\u0000', undefined]) {
    assert.equal((await ping(id, { step: 'heard_from', answer })).status, 204, String(answer));
  }
  assert.equal(heardFromWrites, 0, 'an empty answer writes nothing');
  assert.equal((await ping(id, { step: 'heard_from', answer: 'A friend' })).status, 204);
  assert.equal((await ping(id, { step: 'heard_from', answer: 'A video' })).status, 204);
  assert.equal(heardFrom.get(key), 'A friend', 'a repeat send never overwrites the first answer');
});

test('heard_from: 409 and no write for an install without its row', async () => {
  const response = await ping('progress-install-heard-missing', { step: 'heard_from', answer: 'A friend' });
  assert.equal(response.status, 409);
  assert.equal(heardFromWrites, 0);
  assert.equal(heardFrom.size, 0);
});

test('heard_from: before its migration adds the column, 503 so the app retries', async () => {
  const id = 'progress-install-heard-premigration';
  installs.add(trialInstallKey(id));
  heardFromColumnMissing = true;
  assert.equal((await ping(id, { step: 'heard_from', answer: 'A friend' })).status, 503);
  heardFromColumnMissing = false;
  assert.equal((await ping(id, { step: 'heard_from', answer: 'A friend' })).status, 204);
  assert.equal(heardFrom.get(trialInstallKey(id)), 'A friend');
});

test('older payloads are unaffected: a step without an answer, or an answer on another step, writes no heard_from', async () => {
  const id = 'progress-install-old';
  installs.add(trialInstallKey(id));
  assert.equal((await ping(id, { step: 'onboarded' })).status, 204);
  assert.equal((await ping(id, { step: 'level_answered', answer: 'A friend' })).status, 204);
  assert.deepEqual(upserts.map((u) => u.body.kind), ['onboarded', 'level_answered']);
  assert.deepEqual(Object.keys(upserts[1]!.body).sort(), ['at', 'install_key', 'kind']);
  assert.equal(heardFromWrites, 0);
});

test('heard_from in the memory backend (no Supabase): only for a known install, first answer wins', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const g = globalThis as unknown as { __unvibeTrialInstalls?: Map<string, { startedAt: string; heardFrom?: string }> };
  g.__unvibeTrialInstalls = new Map();
  const id = 'progress-install-memory';
  assert.equal((await ping(id, { step: 'heard_from', answer: 'A friend' })).status, 409, 'no install yet');
  assert.equal(g.__unvibeTrialInstalls.size, 0, 'an answer never creates an install');
  await trialUsageOverview(trialInstallKey(id));
  assert.equal((await ping(id, { step: 'heard_from', answer: ' A  friend ' })).status, 204);
  assert.equal((await ping(id, { step: 'heard_from', answer: 'A video' })).status, 204);
  assert.equal(g.__unvibeTrialInstalls.get(trialInstallKey(id))?.heardFrom, 'A friend');
});

test('heard_from: the answer never reaches a log line, on success or on any error path', async () => {
  const marker = 'Heard-From-Marker-Q7';
  const lines: string[] = [];
  const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  for (const name of ['log', 'info', 'warn', 'error'] as const) {
    console[name] = (...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
  }
  try {
    const id = 'progress-install-heard-logs';
    await ping(id, { step: 'heard_from', answer: marker });
    installs.add(trialInstallKey(id));
    heardFromColumnMissing = true;
    await ping(id, { step: 'heard_from', answer: marker });
    heardFromColumnMissing = false;
    await ping(id, { step: 'heard_from', answer: marker });
  } finally {
    Object.assign(console, saved);
  }
  assert.ok(lines.length > 0, 'the 503 path logged something, so the check is live');
  assert.equal(lines.filter((line) => line.includes(marker)).length, 0, lines.join('\n'));
});

test('heard_from: the stats never carry an answer, even when the database hands one back', async () => {
  const marker = 'Heard-From-Marker-S9';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const table = url.pathname.replace('/rest/v1/', '');
    if ((init?.method ?? 'GET') === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '*/1' } });
    // A careless database: every trial_installs row comes back with every column, the answer included.
    if (table === 'trial_installs') return Response.json([{ install_key: 'k1', started_at: new Date().toISOString(), qa: false, heard_from: marker }]);
    return Response.json([]);
  }) as typeof fetch;
  const stats = await installStats();
  assert.equal(stats.source, 'supabase');
  assert.ok(!JSON.stringify(stats).includes(marker), JSON.stringify(stats));
});
