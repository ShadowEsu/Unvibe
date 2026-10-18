import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../app/api/v1/reviews/route';

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
