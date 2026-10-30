import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST } from '../app/api/v1/feedback/pmf/route';
import { parsePmfAnswer, pmfInstallKey } from '../src/lib/pmfSurvey';
import { trialInstallKey } from '../src/lib/trialAccess';

// The real route runs; only the Supabase HTTP boundary is local, as in trialProgress.test.ts.
const TOKEN = 'local-trial-token-abcdefghijklmnop';
const PREV = { ...process.env };
const previousFetch = globalThis.fetch;
const DAY = 86_400_000;

interface Row extends Record<string, unknown> {
  install_key: string;
  created_at: string;
}

let rows: Row[];
let inserts: Row[];
let rateLimitFull: boolean;
let logged: string[];
const previousError = console.error;

beforeEach(() => {
  process.env.UNVIBE_TRIAL_TOKEN = TOKEN;
  process.env.SUPABASE_URL = 'https://pmf.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  rows = [];
  inserts = [];
  rateLimitFull = false;
  logged = [];
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/trial_reserve') {
      const body = JSON.parse(String(init?.body)) as { p_install_key: string };
      assert.match(body.p_install_key, /^__pmf_ip__:\d{4}-\d{2}-\d{2}:[0-9a-f]{32}$/, 'the per-network key never holds the address');
      return Response.json(rateLimitFull ? -1 : 1);
    }
    if (url.pathname === '/rest/v1/pmf_responses') {
      if ((init?.method ?? 'GET') === 'GET') {
        const key = url.searchParams.get('install_key')?.replace(/^eq\./, '') ?? '';
        const since = url.searchParams.get('created_at')?.replace(/^gte\./, '') ?? '';
        assert.ok(since, 'the repeat check is bounded to a window');
        return Response.json(rows.filter((r) => r.install_key === key && r.created_at >= since).map((_, id) => ({ id })));
      }
      if (init?.method === 'POST') {
        const row = JSON.parse(String(init.body)) as Row;
        inserts.push(row);
        rows.push(row);
        return new Response(null, { status: 201 });
      }
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
  explanations: 7,
  daysSinceInstall: 4,
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

async function badField(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  return body && typeof body === 'object' && 'field' in body ? body.field : undefined;
}

test('201 on a valid answer; the row holds the PMF key, trimmed answers and no raw install ID', async () => {
  const id = 'pmf-install-valid-0001';
  const response = await send(id, valid);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(inserts.length, 1);
  const row = inserts[0]!;
  assert.equal(row.install_key, pmfInstallKey(id));
  assert.match(row.install_key, /^[0-9a-f]{64}$/);
  assert.notEqual(row.install_key, trialInstallKey(id), 'not joinable to the trial tables');
  assert.deepEqual(Object.keys(row).sort(), ['app_version', 'created_at', 'days_since_install', 'explanations', 'install_key', 'q1', 'q2', 'q3', 'q4']);
  assert.equal(row.q2, 'Students learning to code');
  assert.equal(row.q4, '');
  assert.equal(row.explanations, 7);
  assert.equal(row.days_since_install, 4);
  assert.equal(row.app_version, '0.1.47');
  const stored = JSON.stringify(row);
  for (const leak of [id, '198.51.100.30', 'pmf-v1']) assert.equal(stored.includes(leak), false, leak);
});

test('every Q1 value is accepted', async () => {
  for (const [i, q1] of ['very', 'somewhat', 'not', 'na'].entries()) {
    assert.equal((await send(`pmf-install-q1-${i}-abc`, { ...valid, q1 })).status, 201, q1);
  }
  assert.deepEqual(inserts.map((r) => r.q1), ['very', 'somewhat', 'not', 'na']);
});

test('400 on a missing or wrong consent value, and nothing is stored', async () => {
  const id = 'pmf-install-consent-01';
  const noConsent: Record<string, unknown> = { ...valid };
  delete noConsent.consent;
  for (const body of [noConsent, { ...valid, consent: 'pmf-v2' }, { ...valid, consent: true }, { ...valid, consent: ' pmf-v1' }]) {
    const response = await send(id, body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(await badField(response), 'consent');
  }
  assert.equal(inserts.length, 0);
});

test('400 on every bad field', async () => {
  const id = 'pmf-install-fields-01';
  const cases: Array<[string, Record<string, unknown>]> = [
    ['q1', { q1: 'Very disappointed' }],
    ['q1', { q1: undefined }],
    ['q2', { q2: 'x'.repeat(1001) }],
    ['q2', { q2: 5 }],
    ['q3', { q3: null }],
    ['q4', { q4: ['a'] }],
    ['explanations', { explanations: -1 }],
    ['explanations', { explanations: 100_001 }],
    ['explanations', { explanations: 2.5 }],
    ['explanations', { explanations: '7' }],
    ['daysSinceInstall', { daysSinceInstall: 3651 }],
    ['daysSinceInstall', { daysSinceInstall: -2 }],
    ['appVersion', { appVersion: '' }],
    ['appVersion', { appVersion: 'x'.repeat(41) }],
  ];
  for (const [field, patch] of cases) {
    const response = await send(id, { ...valid, ...patch });
    assert.equal(response.status, 400, JSON.stringify(patch));
    assert.equal(await badField(response), field);
  }
  for (const body of ['not json', 'null', '[]', '"very"']) assert.equal((await send(id, body)).status, 400, body);
  assert.equal(inserts.length, 0);
});

test('length limits apply after trimming, so 1000 characters plus spaces is accepted', () => {
  const parsed = parsePmfAnswer({ ...valid, q2: `  ${'é'.repeat(1000)}  `, q3: 'x'.repeat(1000) });
  assert.ok('answer' in parsed);
  if ('answer' in parsed) assert.equal(parsed.answer.q2.length, 1000);
});

test('409 on a repeat within 90 days, keeping the first answer', async () => {
  const id = 'pmf-install-repeat-01';
  assert.equal((await send(id, valid)).status, 201);
  const repeat = await send(id, { ...valid, q1: 'not', q4: 'changed my mind' });
  assert.equal(repeat.status, 409);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0]!.q1, 'very');
});

test('an answer older than 90 days does not block a new one', async () => {
  const id = 'pmf-install-resurvey-1';
  rows.push({ install_key: pmfInstallKey(id), created_at: new Date(Date.now() - 91 * DAY).toISOString() });
  assert.equal((await send(id, valid)).status, 201);
  rows.splice(0);
  rows.push({ install_key: pmfInstallKey(id), created_at: new Date(Date.now() - 89 * DAY).toISOString() });
  assert.equal((await send(id, valid)).status, 409);
});

test('401 without the trial token, with a wrong token, or with a bad install ID', async () => {
  const noToken = await POST(new Request('http://localhost/api/v1/feedback/pmf', {
    method: 'POST', headers: { 'x-unvibe-install-id': 'pmf-install-401-abc' }, body: JSON.stringify(valid),
  }));
  assert.equal(noToken.status, 401);
  assert.equal((await send('pmf-install-401-abc', valid, { authorization: 'Bearer wrong-token-abcdefghijklmnopqrs' })).status, 401);
  assert.equal((await send('bad id!', valid)).status, 401);
  assert.equal((await send('short', valid)).status, 401);
  assert.equal(inserts.length, 0);
});

test('429 when the network is over its daily limit', async () => {
  rateLimitFull = true;
  assert.equal((await send('pmf-install-429-abc', valid)).status, 429);
  assert.equal(inserts.length, 0);
});

test('413 over the body limit', async () => {
  assert.equal((await send('pmf-install-413-abc', { ...valid, pad: 'x'.repeat(30_000) })).status, 413);
  assert.equal(inserts.length, 0);
});

test('a storage failure is a 503 and the log never holds answer text', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/trial_reserve') return Response.json(1);
    if ((init?.method ?? 'GET') === 'GET') return Response.json([]);
    return Response.json({ code: '23514', message: `violates check constraint, Failing row contains (${valid.q3})`, details: valid.q3 }, { status: 400 });
  }) as typeof fetch;
  assert.equal((await send('pmf-install-503-abc', valid)).status, 503);
  assert.ok(logged.length > 0);
  for (const line of logged) assert.equal(line.includes(valid.q3), false, line);
});
