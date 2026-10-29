import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as comprehension } from '../app/api/v1/comprehension/route';
import { selectProvider } from '../src/ai';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
let calls: string[] = [];
const question = { question: 'What does it return?', options: ['One', 'Two'], answerIndex: 0, rationale: 'It returns one.', concept: 'functions', conceptLabel: 'Functions' };

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: 'test', OPENROUTER_API_KEY: 'other-key', ANTHROPIC_API_KEY: 'other-key', GEMINI_API_KEY: 'gemini-key', UNVIBE_TRIAL_TOKEN: 'local-trial-token-abcdefghijklmnop' };
  delete process.env.GOOGLE_API_KEY;
  delete process.env.ENABLE_MOCK_AI;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.hostname);
    assert.equal(url.hostname, 'generativelanguage.googleapis.com');
    const chunk = { candidates: [{ content: { parts: [{ text: JSON.stringify(question) }] } }] };
    return url.pathname.endsWith(':streamGenerateContent')
      ? new Response(`data: ${JSON.stringify(chunk)}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
      : Response.json(chunk);
  };
});
afterEach(() => { process.env = { ...originalEnv }; globalThis.fetch = originalFetch; });

function request(route: string): Request {
  return new Request(`http://localhost/api/v1/${route}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': `provider-consent-${crypto.randomUUID().replaceAll('-', '')}` },
    body: JSON.stringify({ scope: 'selection', level: 'beginner', model: 'anthropic/claude', context: { language: 'typescript', projectStructure: [], imports: [], code: 'const x = 1;' } }),
  });
}

for (const [name, handler] of [['reviews', review], ['comprehension', comprehension]] as const) {
  test(`${name} uses Gemini despite other keys and the requested model`, async () => {
    const response = await handler(request(name));
    assert.equal(response.status, 200);
    await response.text();
    assert.deepEqual(calls, ['generativelanguage.googleapis.com']);
  });
  test(`${name} without Gemini in production refuses before any provider call, even with mock enabled`, async () => {
    Object.assign(process.env, { NODE_ENV: 'production', ENABLE_MOCK_AI: 'true' });
    delete process.env.GEMINI_API_KEY;
    const response = await handler(request(name));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'The AI service is unavailable. Try again later.' });
    assert.deepEqual(calls, []);
  });
}

test('production ignores the mock flag when Gemini is configured', () => {
  Object.assign(process.env, { NODE_ENV: 'production', ENABLE_MOCK_AI: 'true' });
  assert.equal(selectProvider()?.mock, false);
});
test('development mock requires explicit opt-in; Google key alias works', () => {
  delete process.env.GEMINI_API_KEY;
  assert.equal(selectProvider(), null);
  process.env.GOOGLE_API_KEY = 'google-key';
  assert.equal(selectProvider()?.mock, false);
  process.env.ENABLE_MOCK_AI = 'true';
  assert.equal(selectProvider()?.mock, true);
});
