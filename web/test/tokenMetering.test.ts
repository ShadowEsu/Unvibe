import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as comprehension } from '../app/api/v1/comprehension/route';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { trialDailyTokens } from '../src/lib/trialAccess';

// Real route handlers and memory stores; only the remote Gemini HTTP boundary is stubbed.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ENABLE_MOCK_AI;
process.env.GEMINI_API_KEY = 'local-gemini-key';
process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';

type Upstream = 'with-usage' | 'no-usage' | 'hang-after-first-chunk';
let upstream: Upstream = 'with-usage';
const USAGE = { promptTokenCount: 812, candidatesTokenCount: 140, thoughtsTokenCount: 0, totalTokenCount: 952 };
const QUESTION = { question: 'What does it return?', options: ['Its input', 'Nothing'], answerIndex: 0, rationale: 'identity', concept: 'functions', conceptLabel: 'Functions' };

function chunk(text: string, withUsage: boolean): Record<string, unknown> {
  return { candidates: [{ content: { parts: [{ text }] } }], ...(withUsage ? { usageMetadata: USAGE } : {}) };
}

const stubbedFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname !== 'generativelanguage.googleapis.com') throw new Error(`Unexpected request: ${url}`);
  init?.signal?.throwIfAborted();
  if (!url.pathname.endsWith(':streamGenerateContent')) {
    return Response.json(chunk(JSON.stringify(QUESTION), upstream === 'with-usage'));
  }
  if (upstream === 'hang-after-first-chunk') {
    // First words arrive, then the client goes away: the body errors like a real aborted fetch.
    const signal = init?.signal;
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk('This function', false))}\n\n`));
        signal?.addEventListener('abort', () => controller.error(new DOMException('The operation was aborted.', 'AbortError')));
      },
    }), { headers: { 'content-type': 'text/event-stream' } });
  }
  const body = `data: ${JSON.stringify(chunk('This function', false))}\n\n`
    + `data: ${JSON.stringify(chunk(' returns its input.', upstream === 'with-usage'))}\n\n`;
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
};
globalThis.fetch = stubbedFetch;

const context = { language: 'typescript', projectStructure: [], imports: [], code: 'const identity = (x: number) => x;' };

function post(path: string, headers: Record<string, string>, signal?: AbortSignal): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context }),
    signal,
  });
}

async function signedIn(): Promise<{ userId: string; headers: Record<string, string> }> {
  const account = await getStore().signIn(`tokens-${crypto.randomUUID()}@metering.test`);
  await getBillingStore().ensurePersonalWorkspace(account.userId);
  return { userId: account.userId, headers: { authorization: `Bearer ${account.token}` } };
}

function memoryBilling(): MemoryBillingStore {
  const store = getBillingStore();
  assert.ok(store instanceof MemoryBillingStore, 'tests run on the memory billing store');
  return store;
}

test('a signed-in explanation writes Gemini token counts onto its reserved usage row', async () => {
  upstream = 'with-usage';
  const user = await signedIn();
  const response = await review(post('/api/v1/reviews', user.headers));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /"type":"done"/);
  const rows = memoryBilling().usageEvents(user.userId);
  assert.equal(rows.length, 1, 'the reserved row is updated, not joined by a second row');
  assert.equal(rows[0]?.kind, 'ai_explanation');
  assert.equal(rows[0]?.estimatedInputTokens, 812);
  assert.equal(rows[0]?.estimatedOutputTokens, 140);
});

test('without usageMetadata the row keeps null counts and the request still succeeds', async () => {
  upstream = 'no-usage';
  const user = await signedIn();
  const response = await review(post('/api/v1/reviews', user.headers));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /"type":"done"/);
  const rows = memoryBilling().usageEvents(user.userId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.estimatedInputTokens, null);
  assert.equal(rows[0]?.estimatedOutputTokens, null);
});

test('an aborted stream does not crash and records no counts', async () => {
  upstream = 'hang-after-first-chunk';
  const user = await signedIn();
  const gone = new AbortController();
  const response = await review(post('/api/v1/reviews', user.headers, gone.signal));
  assert.equal(response.status, 200);
  const reader = response.body?.getReader();
  assert.ok(reader);
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /This function/);
  gone.abort();
  // Drain to the end: the route must close the stream itself after the abort.
  for (;;) {
    const { done } = await reader.read();
    if (done) break;
  }
  const rows = memoryBilling().usageEvents(user.userId);
  assert.equal(rows.length, 1, 'the person stays charged for a disconnect');
  assert.equal(rows[0]?.estimatedInputTokens, null);
});

test('Test me writes the token counts of its question onto its row', async () => {
  upstream = 'with-usage';
  const user = await signedIn();
  const response = await comprehension(post('/api/v1/comprehension', user.headers));
  assert.equal(response.status, 200);
  const rows = memoryBilling().usageEvents(user.userId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.kind, 'project_question');
  assert.equal(rows[0]?.estimatedInputTokens, 812);
  assert.equal(rows[0]?.estimatedOutputTokens, 140);
});

test('signed-out trial requests add to a daily per-kind total, with no per-install rows', async () => {
  upstream = 'with-usage';
  const installId = `tokens-${crypto.randomUUID().replaceAll('-', '')}`;
  const headers = { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': installId };
  const before = await trialDailyTokens('ai_explanation');
  const response = await review(post('/api/v1/reviews', headers));
  assert.match(await response.text(), /"type":"done"/);
  const after = await trialDailyTokens('ai_explanation');
  assert.deepEqual(after, { inputTokens: before.inputTokens + 812, outputTokens: before.outputTokens + 140 });
  assert.deepEqual(await trialDailyTokens('project_question'), { inputTokens: 0, outputTokens: 0 });
});
