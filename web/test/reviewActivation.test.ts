import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../app/api/v1/reviews/route';
import { recordActivation } from '../src/lib/activation';

// Exercise the real review stream; only the remote AI and database HTTP boundaries are local.
test('activation requires a completed, non-empty selection explanation', async () => {
  const previousEnv = { ...process.env };
  const previousFetch = globalThis.fetch;
  process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';
  process.env.SUPABASE_URL = 'https://activation.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  process.env.GEMINI_API_KEY = 'local-gemini-key';
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ENABLE_MOCK_AI;

  const markers: Array<{ kind: string }> = [];
  let outcome: 'complete' | 'fail' | 'empty' = 'fail';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === 'generativelanguage.googleapis.com') {
      if (outcome === 'fail') return new Response('upstream unavailable', { status: 503 });
      const chunk = { candidates: [{ content: { parts: [{ text: outcome === 'empty' ? '' : 'This function returns its input.' }] } }] };
      return url.pathname.endsWith(':streamGenerateContent')
        ? new Response(`data: ${JSON.stringify(chunk)}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
        : Response.json(chunk);
    }
    if (url.pathname === '/rest/v1/trial_installs') {
      return init?.method === 'POST'
        ? new Response(null, { status: 201 })
        : Response.json([{ started_at: new Date().toISOString() }]);
    }
    if (url.pathname === '/rest/v1/rpc/trial_reserve') return Response.json(1);
    // A failed or empty answer gives the reserved unit back (compare-and-swap on the counter).
    if (url.pathname === '/rest/v1/trial_counters') {
      return init?.method === 'PATCH' ? Response.json([{ used: 0 }]) : Response.json([{ used: 1 }]);
    }
    if (url.pathname === '/rest/v1/trial_activation') {
      markers.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;

  const explain = async (installId: string, extra = {}) => {
    const response = await POST(new Request('http://localhost/api/v1/reviews', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': installId },
      body: JSON.stringify({ scope: 'selection', level: 'beginner', context: { code: 'const identity = x => x;' }, ...extra }),
    }));
    assert.equal(response.status, 200);
    return response.text();
  };

  try {
    const failed = await explain('activation-retry-install');
    assert.match(failed, /"type":"error"/);
    assert.equal(markers.length, 0, 'an upstream failure must not activate an install');

    outcome = 'empty';
    await explain('activation-empty-install');
    assert.equal(markers.length, 0, 'an empty upstream answer must not count as explained');

    outcome = 'complete';
    const completed = await explain('activation-retry-install');
    assert.match(completed, /This function returns its input/);
    assert.match(completed, /"type":"done"/);
    assert.deepEqual(markers.map((marker) => marker.kind), ['code']);

    await explain('activation-retry-install');
    assert.equal(markers.length, 1, 'a repeat explanation must not count as a new activation');

    await explain('activation-followup-install', { question: 'Why?' });
    assert.equal(markers.length, 1, 'a follow-up is not a first selection explanation');
  } finally {
    globalThis.fetch = previousFetch;
    process.env = previousEnv;
  }
});

// `return` (instrumentation spec 6.3 and 11.1 item 3), with started_at = T.
test('return marker needs an earlier first explanation in an earlier 24 h block of the first week', async () => {
  const previousEnv = { ...process.env };
  const previousFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://return.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  const T = Date.parse('2026-10-20T08:00:00.000Z');
  const hours = (h: number) => new Date(T + h * 3_600_000);
  let firstMarkerAt: Date | null = null;
  const written: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname !== '/rest/v1/trial_activation') throw new Error(`Unexpected request: ${url.pathname}`);
    if (init?.method === 'POST') {
      written.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(null, { status: 201 });
    }
    assert.equal(url.searchParams.get('kind'), 'in.(sample,code)');
    return Response.json(firstMarkerAt ? [{ at: firstMarkerAt.toISOString() }] : []);
  }) as typeof fetch;
  const cases: Array<{ name: string; first: number; now: number; expected: boolean }> = [
    { name: 'sample at T+5 min, explanation at T+30 h', first: 5 / 60, now: 30, expected: true },
    { name: 'sample at T+5 min, explanation at T+3 h', first: 5 / 60, now: 3, expected: false },
    { name: 'code at T+26 h, explanation at T+27 h (same block)', first: 26, now: 27, expected: false },
    { name: 'code at T+26 h, explanation at T+50 h', first: 26, now: 50, expected: true },
    { name: 'explanation at T+8 d', first: 5 / 60, now: 8 * 24, expected: false },
  ];
  try {
    for (const [i, c] of cases.entries()) {
      written.length = 0;
      firstMarkerAt = hours(c.first);
      await recordActivation(`return-install-${i}`, 'const own = 1;', { now: hours(c.now), startedAt: new Date(T).toISOString() });
      const returns = written.filter((row) => row.kind === 'return');
      assert.equal(returns.length, c.expected ? 1 : 0, c.name);
      if (c.expected) assert.deepEqual(Object.keys(returns[0]!).sort(), ['at', 'install_key', 'kind'], 'timestamp only');
    }
    written.length = 0;
    firstMarkerAt = hours(1);
    await recordActivation('return-install-0', 'const own = 1;', { now: hours(40), startedAt: new Date(T).toISOString() });
    assert.equal(written.length, 0, 'write-once: a later return in the same instance skips the round trip');
  } finally {
    globalThis.fetch = previousFetch;
    process.env = previousEnv;
  }
});
