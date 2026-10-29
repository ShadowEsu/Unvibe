import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { ANTHROPIC_HOST, anthropicError } from './anthropicStub';

// Real route handler and memory stores; only the remote AI HTTP boundary is local.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.ENABLE_MOCK_AI;
process.env.ANTHROPIC_API_KEY = 'local-anthropic-key';
process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';

const GENERIC = 'The AI service had a problem. Try again in a minute.';
// What Anthropic sends back for a bad key: the message is provider text, which may hint at the key.
const PROVIDER_MESSAGE = 'invalid x-api-key';

let upstream: 'http-error' | 'network-error' = 'http-error';
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.hostname !== ANTHROPIC_HOST) throw new Error(`Unexpected request: ${url}`);
  if (upstream === 'network-error') throw new Error(`getaddrinfo ENOTFOUND ${ANTHROPIC_HOST}`);
  return anthropicError(401, 'authentication_error', PROVIDER_MESSAGE);
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

test('a provider HTTP error reaches the client as a plain message, and the server log keeps the status and error type only', async () => {
  upstream = 'http-error';
  const { message, logged } = await failedReview();
  assert.equal(message, GENERIC);
  assert.match(logged, /Anthropic API 401: authentication_error/, 'the provider status and error type must be logged for the team');
  assert.doesNotMatch(logged, new RegExp(PROVIDER_MESSAGE), 'the provider message is never logged: it could quote the key');
});

test('a provider network error does not leak its detail to the client or the log', async () => {
  upstream = 'network-error';
  const { message, logged } = await failedReview();
  assert.equal(message, GENERIC);
  assert.match(logged, /review provider failed Error/, 'the failure is logged by its error class');
  assert.doesNotMatch(logged, /ENOTFOUND/);
});
