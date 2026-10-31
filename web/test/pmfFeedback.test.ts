import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import { POST } from '../app/api/v1/feedback/pmf/route';
import { pmfInstallKey, recordPmfAnswer } from '../src/lib/pmfSurvey';
import { trialInstallKey } from '../src/lib/trialAccess';

// The real route runs; only the Supabase HTTP boundary is local, as in trialProgress.test.ts. The
// fake submit_pmf_response applies the migration's 90-day rule to the rows it holds.
const TOKEN = 'local-trial-token-abcdefghijklmnop';
const SERVICE_KEY = 'local-service-key';
const PREV = { ...process.env };
const previousFetch = globalThis.fetch;
const previousError = console.error;
const DAY = 86_400_000;

interface Row {
  install_key: string;
  created_at: string;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  app_version: string;
}

let rows: Row[];
let rpcBodies: Array<Record<string, unknown>>;
let limiterBuckets: string[];
let limited: boolean;
let logged: string[];

beforeEach(() => {
  process.env.UNVIBE_TRIAL_TOKEN = TOKEN;
  process.env.SUPABASE_URL = 'https://pmf.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  delete process.env.TRY_IP_SALT;
  rows = [];
  rpcBodies = [];
  limiterBuckets = [];
  limited = false;
  logged = [];
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    if (url.pathname === '/rest/v1/rpc/consume_rate_limit') {
      limiterBuckets.push(String(body.p_bucket));
      return Response.json(!limited);
    }
    if (url.pathname === '/rest/v1/rpc/submit_pmf_response') {
      rpcBodies.push(body);
      const key = String(body.p_install_key);
      const since = new Date(Date.now() - 90 * DAY).toISOString();
      if (rows.some((r) => r.install_key === key && r.created_at >= since)) return Response.json('duplicate');
      rows.push({
        install_key: key, created_at: new Date().toISOString(), q1: String(body.p_q1), q2: String(body.p_q2),
        q3: String(body.p_q3), q4: String(body.p_q4), app_version: String(body.p_app_version),
      });
      return Response.json('ok');
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url.pathname}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  console.error = previousError;
  process.env = { ...PREV };
});

const valid = {
  q1: 'very',
  q2: '  Students learning to code  ',
  q3: 'I finally understand what the AI wrote',
  q4: '',
  appVersion: '0.1.47',
  consent: 'pmf-v1',
};

const send = (installId: string, body: unknown, headers: Record<string, string> = {}) => POST(new Request('http://localhost/api/v1/feedback/pmf', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${TOKEN}`,
    'x-unvibe-install-id': installId,
    'content-type': 'application/json',
    'x-forwarded-for': '198.51.100.30',
    ...headers,
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));

async function json(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  return body && typeof body === 'object' ? { ...body } : {};
}

test('201 on a valid answer; the row holds an HMAC of the install ID, trimmed answers and nothing else', async () => {
  const id = 'pmf-install-valid-0001';
  const response = await send(id, valid);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  const hmac = createHmac('sha256', SERVICE_KEY).update(`unvibe-pmf-install:${id}`).digest('hex');
  assert.equal(row.install_key, hmac, 'keyed with the same secret and fallback as the try_requests IP hashes');
  assert.equal(row.install_key, pmfInstallKey(id));
  assert.notEqual(row.install_key, createHash('sha256').update(`unvibe-pmf-install:${id}`).digest('hex'), 'not a plain sha256');
  assert.notEqual(row.install_key, trialInstallKey(id), 'not joinable to the trial tables');
  assert.deepEqual(Object.keys(rpcBodies[0]!).sort(), ['p_app_version', 'p_install_key', 'p_q1', 'p_q2', 'p_q3', 'p_q4']);
  assert.equal(row.q2, 'Students learning to code');
  assert.equal(row.q4, '');
  assert.equal(row.app_version, '0.1.47');
  const stored = JSON.stringify(rpcBodies[0]);
  for (const leak of [id, '198.51.100.30', 'pmf-v1']) assert.equal(stored.includes(leak), false, leak);
});

test('TRY_IP_SALT keys the install HMAC when set', async () => {
  process.env.TRY_IP_SALT = 'pmf-test-salt-0123456789';
  const id = 'pmf-install-salted-01';
  assert.equal((await send(id, valid)).status, 201);
  assert.equal(rows[0]!.install_key, createHmac('sha256', 'pmf-test-salt-0123456789').update(`unvibe-pmf-install:${id}`).digest('hex'));
});

test('every Q1 value in the table check is accepted', async () => {
  for (const [i, q1] of ['very', 'somewhat', 'not', 'na'].entries()) {
    assert.equal((await send(`pmf-install-q1-${i}-abc`, { ...valid, q1 })).status, 201, q1);
  }
  assert.deepEqual(rows.map((r) => r.q1), ['very', 'somewhat', 'not', 'na']);
});

test('400 on a missing or wrong consent value, and nothing is stored', async () => {
  const noConsent: Record<string, unknown> = { ...valid };
  delete noConsent.consent;
  for (const body of [noConsent, { ...valid, consent: 'pmf-v2' }, { ...valid, consent: true }, { ...valid, consent: ' pmf-v1' }]) {
    const response = await send('pmf-install-consent-01', body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await json(response)).field, 'consent');
  }
  assert.equal(rpcBodies.length, 0);
});

test('400 on unknown keys, including the usage counts the app no longer sends', async () => {
  for (const extra of [{ explanations: 7 }, { daysSinceInstall: 4 }, { email: 'a@b.c' }, { installId: 'x' }]) {
    const response = await send('pmf-install-unknown-1', { ...valid, ...extra });
    assert.equal(response.status, 400, JSON.stringify(extra));
    assert.equal((await json(response)).field, 'unknown_key');
  }
  assert.equal(rpcBodies.length, 0);
});

test('length caps: 2,000 characters per text is accepted, 2,001 is refused, after trimming', async () => {
  assert.equal((await send('pmf-install-cap-ok-01', { ...valid, q2: `  ${'a'.repeat(2000)}  `, q3: 'b'.repeat(2000), q4: 'c'.repeat(2000) })).status, 201);
  assert.equal(rows[0]!.q2.length, 2000);
  for (const key of ['q2', 'q3', 'q4']) {
    const response = await send('pmf-install-cap-no-01', { ...valid, [key]: 'x'.repeat(2001) });
    assert.equal(response.status, 400, key);
    assert.equal((await json(response)).field, key);
  }
  assert.equal(rows.length, 1);
});

test('400 on every other bad field; q2 to q4 may be missing (empty)', async () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['q1', { q1: 'Very disappointed' }],
    ['q1', { q1: undefined }],
    ['q2', { q2: 5 }],
    ['q3', { q3: null }],
    ['q4', { q4: ['a'] }],
    ['appVersion', { appVersion: '' }],
    ['appVersion', { appVersion: 'x'.repeat(41) }],
    ['appVersion', { appVersion: '0.1.47 <b>' }],
  ];
  for (const [field, patch] of cases) {
    const response = await send('pmf-install-fields-01', { ...valid, ...patch });
    assert.equal(response.status, 400, JSON.stringify(patch));
    assert.equal((await json(response)).field, field);
  }
  assert.equal(rpcBodies.length, 0);
  assert.equal((await send('pmf-install-minimal-1', { q1: 'na', appVersion: '0.1.47', consent: 'pmf-v1' })).status, 201);
});

test('bad input is a 400, never a 500', async () => {
  for (const body of ['not json', 'null', '[]', '"very"', '{', '{"q1":', '\u0000']) {
    assert.equal((await send('pmf-install-garbage-1', body)).status, 400, body);
  }
  assert.equal(rpcBodies.length, 0);
});

test('a text that looks like a key or password is refused with its field name only', async () => {
  // AWS's documented example key and generated look-alikes, so no key-shaped literal sits in the repo.
  const fakes = [['q2', 'AKIAIOSFODNN7EXAMPLE'], ['q3', `sk-${'a1B2'.repeat(6)}`], ['q4', `-----BEGIN ${'PRIVATE'} KEY-----`]] as const;
  for (const [key, secret] of fakes) {
    const response = await send('pmf-install-secret-01', { ...valid, [key]: `here: ${secret}` });
    assert.equal(response.status, 400, key);
    const body = await json(response);
    assert.deepEqual(body, { error: 'secret_detected', field: key });
  }
  assert.equal(rpcBodies.length, 0);
});

test('409 on a repeat within 90 days, keeping the first answer', async () => {
  const id = 'pmf-install-repeat-01';
  assert.equal((await send(id, valid)).status, 201);
  const repeat = await send(id, { ...valid, q1: 'not', q4: 'changed my mind' });
  assert.equal(repeat.status, 409);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.q1, 'very');
});

test('the 90-day rule itself: 89 days later is refused, 91 days later is stored (process-memory store)', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = 'a'.repeat(64);
  const answer = { q1: 'somewhat' as const, q2: '', q3: '', q4: '', appVersion: '0.1.47' };
  const first = new Date('2027-01-01T00:00:00Z');
  assert.equal(await recordPmfAnswer(key, answer, first), 'stored');
  assert.equal(await recordPmfAnswer(key, answer, new Date(first.getTime() + 89 * DAY)), 'duplicate');
  assert.equal(await recordPmfAnswer(key, answer, new Date(first.getTime() + 91 * DAY)), 'stored');
});

test('401 without the trial token, with a wrong token, or with a bad install ID', async () => {
  const noToken = await POST(new Request('http://localhost/api/v1/feedback/pmf', {
    method: 'POST', headers: { 'x-unvibe-install-id': 'pmf-install-401-abc', 'content-type': 'application/json' }, body: JSON.stringify(valid),
  }));
  assert.equal(noToken.status, 401);
  assert.equal((await send('pmf-install-401-abc', valid, { authorization: 'Bearer wrong-token-abcdefghijklmnopqrs' })).status, 401);
  assert.equal((await send('bad id!', valid)).status, 401);
  assert.equal((await send('short', valid)).status, 401);
  assert.equal(rpcBodies.length, 0);
});

test('a web page origin is refused and no CORS header is ever granted', async () => {
  const fromSite = await send('pmf-install-origin-01', valid, { origin: 'https://unvibe.site' });
  assert.equal(fromSite.status, 403);
  assert.equal(fromSite.headers.get('access-control-allow-origin'), null);
  assert.equal((await send('pmf-install-origin-01', valid, { origin: 'http://evil.test' })).status, 403);
  const fromApp = await send('pmf-install-origin-01', valid);
  assert.equal(fromApp.status, 201, 'the app (main process, no Origin) is accepted');
  assert.equal(fromApp.headers.get('access-control-allow-origin'), null);
});

test('415 when the body is not declared as JSON', async () => {
  assert.equal((await send('pmf-install-415-abc', valid, { 'content-type': 'text/plain' })).status, 415);
  assert.equal(rpcBodies.length, 0);
});

test('413 over 16 KB', async () => {
  assert.equal((await send('pmf-install-413-abc', JSON.stringify(valid).replace('}', `,"pad":"${'x'.repeat(16_400)}"}`))).status, 413);
  assert.equal(rpcBodies.length, 0);
});

test('429 when the network is over its hourly limit; the limiter key is an HMAC of the IP', async () => {
  limited = true;
  assert.equal((await send('pmf-install-429-abc', valid)).status, 429);
  assert.equal(rpcBodies.length, 0);
  assert.match(limiterBuckets[0]!, /^pmf-ip:[0-9a-f]{32}$/);
  assert.equal(limiterBuckets.join(' ').includes('198.51.100.30'), false);
});

test('a storage failure is a 503 and no log line holds answer text', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/consume_rate_limit') return Response.json(true);
    return Response.json({ code: '23514', message: `violates check constraint, Failing row contains (${valid.q3})`, details: valid.q3 }, { status: 400 });
  }) as typeof fetch;
  assert.equal((await send('pmf-install-503-abc', valid)).status, 503);
  assert.ok(logged.length > 0);
  for (const line of logged) assert.equal(line.includes(valid.q3), false, line);
});
