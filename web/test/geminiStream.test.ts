import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiProvider } from '../src/ai/gemini';
import { billedUsage } from '../src/ai/provider';

function sse(text: string): string {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;
}

test('gemini stream emits tokens as each chunk arrives, not at the end', async () => {
  const chunks = [sse('Hello'), sse(' there'), sse(' friend')];
  const seenBeforeEnd: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(chunks[0] + chunks[1]));
      await gate; // hold the stream open: the first tokens must already be out
      controller.enqueue(enc.encode(chunks[2]));
      controller.close();
    },
  }), { status: 200 })) as typeof fetch;
  try {
    const got: string[] = [];
    const run = new GeminiProvider('key', 'm', 100).stream('s', 'u', (t) => got.push(t));
    await new Promise((r) => setTimeout(r, 20));
    seenBeforeEnd.push(...got);
    release();
    await run;
    assert.deepEqual(seenBeforeEnd, ['Hello', ' there']);
    assert.equal(got.join(''), 'Hello there friend');
  } finally {
    globalThis.fetch = original;
  }
});

test('gemini stream still handles a JSON array body', async () => {
  const original = globalThis.fetch;
  const body = JSON.stringify([{ candidates: [{ content: { parts: [{ text: 'A' }] } }] }, { candidates: [{ content: { parts: [{ text: 'B' }] } }] }]);
  globalThis.fetch = (async () => new Response(body, { status: 200 })) as typeof fetch;
  try {
    const got: string[] = [];
    await new GeminiProvider('key', 'm', 100).stream('s', 'u', (t) => got.push(t));
    assert.equal(got.join(''), 'AB');
  } finally {
    globalThis.fetch = original;
  }
});

const USAGE = { promptTokenCount: 812, candidatesTokenCount: 140, thoughtsTokenCount: 6, totalTokenCount: 958 };

async function withFetch<T>(body: string, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const stubbed: typeof fetch = async () => new Response(body, { status: 200 });
  globalThis.fetch = stubbed;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test('gemini stream returns token counts from the final chunk; thinking is billed as output', async () => {
  // Gemini repeats usageMetadata on chunks; the final chunk holds the totals.
  const early = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hi' }] } }], usageMetadata: { promptTokenCount: 812, candidatesTokenCount: 1 } })}\n\n`;
  const last = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: ' there' }] } }], usageMetadata: USAGE })}\n\n`;
  const usage = await withFetch(early + last, () => new GeminiProvider('key', 'm', 100).stream('s', 'u', () => undefined));
  assert.deepEqual(usage, { inputTokens: 812, outputTokens: 146 });
});

// Prompt = system + user. chars/4, rounded up (https://ai.google.dev/gemini-api/docs/tokens).
const SYSTEM = 's'.repeat(40);
const USER = 'u'.repeat(41);

test('gemini stream without usageMetadata estimates chars/4 and marks it estimated', async () => {
  const usage = await withFetch(sse('Hello there!'), () => new GeminiProvider('key', 'm', 100).stream(SYSTEM, USER, () => undefined));
  assert.deepEqual(usage, { inputTokens: 21, outputTokens: 3, estimated: true });
});

test('gemini treats token counts that are not non-negative integers as missing, so they are estimated', async () => {
  for (const bad of [{ promptTokenCount: -1, candidatesTokenCount: 3 }, { promptTokenCount: 1.5, candidatesTokenCount: 3 }, { promptTokenCount: '9', candidatesTokenCount: 3 }]) {
    const body = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x' }] } }], usageMetadata: bad })}\n\n`;
    const usage = await withFetch(body, () => new GeminiProvider('key', 'm', 100).stream(SYSTEM, USER, () => undefined));
    assert.deepEqual(usage, { inputTokens: 21, outputTokens: 1, estimated: true }, JSON.stringify(bad));
  }
});

test('a stream cut off after Gemini answered rejects with an estimate of what was delivered', async () => {
  const original = globalThis.fetch;
  // First read gets one chunk; the next read fails like a dropped connection.
  let reads = 0;
  const cut: typeof fetch = async () => new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      reads += 1;
      if (reads === 1) controller.enqueue(new TextEncoder().encode(sse('12345678')));
      else controller.error(new DOMException('The operation was aborted.', 'AbortError'));
    },
  }), { status: 200 });
  globalThis.fetch = cut;
  try {
    const error: unknown = await new GeminiProvider('key', 'm', 100).stream(SYSTEM, USER, () => undefined).then(() => null, (e: unknown) => e);
    assert.ok(error instanceof Error, 'the stream still fails, so the route reports the error');
    assert.deepEqual(billedUsage(error), { inputTokens: 21, outputTokens: 2, estimated: true });
  } finally {
    globalThis.fetch = original;
  }
});

test('a request Gemini refused or never answered carries no usage', async () => {
  const original = globalThis.fetch;
  try {
    const refused: typeof fetch = async () => new Response('quota', { status: 429 });
    globalThis.fetch = refused;
    const rejected: unknown = await new GeminiProvider('key', 'm', 100).stream(SYSTEM, USER, () => undefined).then(() => null, (e: unknown) => e);
    assert.ok(rejected instanceof Error);
    assert.equal(billedUsage(rejected), undefined);
    const offline: typeof fetch = async () => { throw new TypeError('fetch failed'); };
    globalThis.fetch = offline;
    const unreachable: unknown = await new GeminiProvider('key', 'm', 100).complete(SYSTEM, USER).then(() => null, (e: unknown) => e);
    assert.ok(unreachable instanceof Error);
    assert.equal(billedUsage(unreachable), undefined);
  } finally {
    globalThis.fetch = original;
  }
});

test('gemini complete without usageMetadata estimates from the prompt and the answer', async () => {
  const body = JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"q":1}' }] } }] });
  const result = await withFetch(body, () => new GeminiProvider('key', 'm', 100).complete(SYSTEM, USER));
  assert.deepEqual(result, { text: '{"q":1}', usage: { inputTokens: 21, outputTokens: 2, estimated: true } });
});

test('gemini complete returns the text and its token counts', async () => {
  const body = JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"q":1}' }] } }], usageMetadata: USAGE });
  const result = await withFetch(body, () => new GeminiProvider('key', 'm', 100).complete('s', 'u'));
  assert.deepEqual(result, { text: '{"q":1}', usage: { inputTokens: 812, outputTokens: 146 } });
});

test('gemini stream counts a JSON array body by its last chunk', async () => {
  const body = JSON.stringify([
    { candidates: [{ content: { parts: [{ text: 'A' }] } }] },
    { candidates: [{ content: { parts: [{ text: 'B' }] } }], usageMetadata: USAGE },
  ]);
  const usage = await withFetch(body, () => new GeminiProvider('key', 'm', 100).stream('s', 'u', () => undefined));
  assert.deepEqual(usage, { inputTokens: 812, outputTokens: 146 });
});
