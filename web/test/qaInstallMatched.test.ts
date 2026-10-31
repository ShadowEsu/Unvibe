import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST as qaInstall } from '../app/api/v1/admin/qa-install/route';
import { trialInstallKey } from '../src/lib/trialAccess';

// Security 31 Oct: a 200 from qa-install must say whether the app's own install row was flagged,
// so CI can fail when it flagged nothing (a wrong id, or the app never reached the API).
const QA_TOKEN = 'test-qa-flag-token-0123456789abcdef';
const previousFetch = globalThis.fetch;
let rows: Map<string, { install_key: string; qa: boolean }>;
let failWrites = false;

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://qa.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.UNVIBE_QA_FLAG_TOKEN = QA_TOKEN;
  rows = new Map();
  failWrites = false;
  // trial_installs as PostgREST serves it: PATCH ?install_key=eq.<key> returns the updated rows, POST upserts.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (url.pathname !== '/rest/v1/trial_installs') throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    if (failWrites) return Response.json({ code: '57014', message: 'canceling statement due to statement timeout' }, { status: 500 });
    const body = JSON.parse(String(init?.body ?? 'null'));
    if (method === 'PATCH') {
      const key = url.searchParams.get('install_key')?.replace(/^eq\./, '') ?? '';
      const row = rows.get(key);
      if (row) Object.assign(row, body);
      return Response.json(row ? [{ install_key: row.install_key }] : []);
    }
    if (method === 'POST') {
      assert.equal(url.searchParams.get('on_conflict'), 'install_key');
      for (const item of Array.isArray(body) ? body : [body]) rows.set(item.install_key, { ...rows.get(item.install_key), ...item });
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = previousFetch;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

const flag = (installId: string) =>
  qaInstall(new Request('https://api.unvibe.site/api/v1/admin/qa-install', {
    method: 'POST',
    headers: { authorization: `Bearer ${QA_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ installId }),
  }));

test('an install the app registered is flagged and reported as matched', async () => {
  const key = trialInstallKey('qa-release-123-1');
  rows.set(key, { install_key: key, qa: false });
  const res = await flag('qa-release-123-1');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, matched: true });
  assert.equal(rows.get(key)?.qa, true);
  assert.equal(rows.size, 1);
});

test('an id the app never registered answers matched false, and the row is pre-flagged for a late registration', async () => {
  rows.set(trialInstallKey('someone-else-1'), { install_key: trialInstallKey('someone-else-1'), qa: false });
  const res = await flag('qa-release-typo-1');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, matched: false });
  assert.equal(rows.get(trialInstallKey('qa-release-typo-1'))?.qa, true);
  assert.equal(rows.get(trialInstallKey('someone-else-1'))?.qa, false, 'no other install is touched');
});

test('a failed write is a 500, never a 200', async () => {
  failWrites = true;
  const res = await flag('qa-release-123-1');
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: 'write_failed' });
});
