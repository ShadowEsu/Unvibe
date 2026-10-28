import assert from 'node:assert/strict';
import test from 'node:test';
import { POST as tryRoute } from '../app/api/v1/try/route';
import { TRY_CONSENT_VERSION } from '../src/lib/tryDemo';

// Real route handler and the in-memory limiter; only Google's HTTP endpoint is local, and counted.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.ENABLE_MOCK_AI;
process.env.GEMINI_API_KEY = 'local-gemini-key';

let providerCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.hostname !== 'generativelanguage.googleapis.com') throw new Error(`Unexpected request: ${url}`);
  providerCalls += 1;
  return Response.json({ candidates: [{ content: { parts: [{ text: '**Sets a to 1.**' }] } }] });
}) as typeof fetch;

const code = 'const a = 1;';
const consent = { v: TRY_CONSENT_VERSION, aiSend: true, age18: true };

function post(body: unknown): Promise<Response> {
  return tryRoute(new Request('http://localhost/api/v1/try', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  }));
}

test('a body without both ticks is a 400 and never reaches Gemini', async () => {
  const refused = [
    { code },
    { code, consent: { ...consent, v: '2026-01-01' } },
    { code, consent: { ...consent, aiSend: false } },
    { code, consent: { v: TRY_CONSENT_VERSION, aiSend: true } },
  ];
  for (const body of refused) {
    const response = await post(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.deepEqual(await response.json(), { error: 'Tick both boxes to send this code to Gemini.' });
  }
  assert.equal(providerCalls, 0);
});

test('a body with both ticks for the current version is explained', async () => {
  const response = await post({ code, consent });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, text: '**Sets a to 1.**', level: 'intermediate' });
  assert.equal(providerCalls, 1);
});
