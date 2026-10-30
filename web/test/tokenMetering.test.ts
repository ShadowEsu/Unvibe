import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as comprehension } from '../app/api/v1/comprehension/route';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { trialDailyTokens } from '../src/lib/trialAccess';
import { ANTHROPIC_HOST, anthropicMessage, anthropicStream, streamBody, wantsStream } from './anthropicStub';

// Real route handlers and memory stores; only the remote Anthropic HTTP boundary is stubbed.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.ENABLE_MOCK_AI;
process.env.ANTHROPIC_API_KEY = 'local-anthropic-key';
process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';

type Upstream = 'with-usage' | 'no-usage' | 'hang-after-first-chunk';
let upstream: Upstream = 'with-usage';
const USAGE = { input_tokens: 812, output_tokens: 140 };
const QUESTION = { question: 'What does it return?', options: ['Its input', 'Nothing'], answerIndex: 0, rationale: 'identity', concept: 'functions', conceptLabel: 'Functions' };

const stubbedFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname !== ANTHROPIC_HOST) throw new Error(`Unexpected request: ${url}`);
  init?.signal?.throwIfAborted();
  const usage = upstream === 'with-usage' ? USAGE : null;
  if (!wantsStream(init)) return anthropicMessage(JSON.stringify(QUESTION), usage);
  if (upstream === 'hang-after-first-chunk') {
    // First words arrive, then the client goes away: the body errors like a real aborted fetch.
    const signal = init?.signal;
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(streamBody(['This function'], null, false)));
        signal?.addEventListener('abort', () => controller.error(new DOMException('The operation was aborted.', 'AbortError')));
      },
    }), { headers: { 'content-type': 'text/event-stream' } });
  }
  return anthropicStream(['This function', ' returns its input.'], usage);
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

test('a signed-in explanation writes Anthropic token counts onto its reserved usage row', async () => {
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
  assert.equal(rows[0]?.tokensEstimated, false, 'measured counts are not marked as estimates');
});

/** chars/4 rounded up, the estimate rule. */
const quarter = (chars: number): number => Math.ceil(chars / 4);

test('without usage the row gets a chars/4 estimate marked as estimated, and the request still succeeds', async () => {
  upstream = 'no-usage';
  const user = await signedIn();
  const response = await review(post('/api/v1/reviews', user.headers));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /"type":"done"/);
  const rows = memoryBilling().usageEvents(user.userId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.tokensEstimated, true);
  assert.ok((rows[0]?.estimatedInputTokens ?? 0) > 0, 'the prompt was sent, so input is estimated');
  assert.equal(rows[0]?.estimatedOutputTokens, quarter('This function returns its input.'.length));
});

test('an aborted stream does not crash and records an estimate of what was delivered', async () => {
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
  assert.equal(rows[0]?.tokensEstimated, true);
  assert.ok((rows[0]?.estimatedInputTokens ?? 0) > 0);
  assert.equal(rows[0]?.estimatedOutputTokens, quarter('This function'.length));
});

test('an aborted trial stream adds to the estimate totals and leaves the measured totals alone', async () => {
  upstream = 'hang-after-first-chunk';
  const installId = `tokens-${crypto.randomUUID().replaceAll('-', '')}`;
  const headers = { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': installId };
  const measuredBefore = await trialDailyTokens('ai_explanation');
  const estimatedBefore = await trialDailyTokens('ai_explanation', { estimated: true });
  const gone = new AbortController();
  const response = await review(post('/api/v1/reviews', headers, gone.signal));
  const reader = response.body?.getReader();
  assert.ok(reader);
  await reader.read();
  gone.abort();
  for (;;) {
    const { done } = await reader.read();
    if (done) break;
  }
  assert.deepEqual(await trialDailyTokens('ai_explanation'), measuredBefore);
  const estimatedAfter = await trialDailyTokens('ai_explanation', { estimated: true });
  assert.ok(estimatedAfter.inputTokens > estimatedBefore.inputTokens);
  assert.equal(estimatedAfter.outputTokens, estimatedBefore.outputTokens + quarter('This function'.length));
});

test('a request refused before reaching Anthropic records nothing', async () => {
  upstream = 'with-usage';
  const user = await signedIn();
  const billing = getBillingStore();
  const reserveUsage = billing.reserveUsage;
  billing.reserveUsage = async () => { throw new Error('billing database unavailable'); };
  const estimatedBefore = await trialDailyTokens('ai_explanation', { estimated: true });
  try {
    assert.equal((await review(post('/api/v1/reviews', user.headers))).status, 503);
  } finally {
    billing.reserveUsage = reserveUsage;
  }
  assert.equal(memoryBilling().usageEvents(user.userId).length, 0);
  assert.deepEqual(await trialDailyTokens('ai_explanation', { estimated: true }), estimatedBefore);
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
