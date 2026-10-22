import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';

// Real route handler and memory stores; only the remote AI HTTP boundary is local.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ENABLE_MOCK_AI;
process.env.GEMINI_API_KEY = 'local-gemini-key';
process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';

const GENERIC = 'The AI service had a problem. Try again in a minute.';
// What Google sends back for a bad key or a quota problem: project ids, key hints, policy text.
const PROVIDER_BODY = '{"error":{"code":400,"message":"API key not valid for project 1234567890. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}';

let upstream: 'http-error' | 'network-error' = 'http-error';
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.hostname !== 'generativelanguage.googleapis.com') throw new Error(`Unexpected request: ${url}`);
  if (upstream === 'network-error') throw new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com');
  return new Response(PROVIDER_BODY, { status: 400 });
}) as typeof fetch;

function explainRequest(): Request {
  const installId = `provider-error-${crypto.randomUUID().replaceAll('-', '')}`;
  return new Request('http://localhost/api/v1/reviews', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': installId },
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context: { language: 'typescript', projectStructure: [], imports: [], code: 'const x = 1;' } }),
  });
}

/** Runs one review and returns the streamed error event plus everything logged with console.error. */
async function failedReview(): Promise<{ message: unknown; logged: string }> {
  const logs: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logs.push(args); };
  let body: string;
  try {
    const response = await review(explainRequest());
    assert.equal(response.status, 200);
    body = await response.text();
  } finally {
    console.error = original;
  }
  const events = body.split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')) as Record<string, unknown>);
  const error = events.find((event) => event.type === 'error');
  assert.ok(error, 'the stream must end with an error event');
  const logged = logs.map((args) => args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ')).join('\n');
  return { message: error.message, logged };
}

test('a provider HTTP error reaches the client as a plain message, and the detail stays in the server log', async () => {
  upstream = 'http-error';
  const { message, logged } = await failedReview();
  assert.equal(message, GENERIC);
  assert.match(logged, /Gemini API 400/, 'the provider status must be logged for the team');
  assert.match(logged, /API key not valid/, 'the provider body must be logged for the team');
});

test('a provider network error does not leak its detail either', async () => {
  upstream = 'network-error';
  const { message, logged } = await failedReview();
  assert.equal(message, GENERIC);
  assert.match(logged, /ENOTFOUND/);
});
