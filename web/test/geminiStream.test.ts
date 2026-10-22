import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiProvider } from '../src/ai/gemini';

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

test('gemini stream without usageMetadata returns no counts', async () => {
  const usage = await withFetch(sse('Hello'), () => new GeminiProvider('key', 'm', 100).stream('s', 'u', () => undefined));
  assert.equal(usage, undefined);
});

test('gemini ignores token counts that are not non-negative integers', async () => {
  for (const bad of [{ promptTokenCount: -1, candidatesTokenCount: 3 }, { promptTokenCount: 1.5, candidatesTokenCount: 3 }, { promptTokenCount: '9', candidatesTokenCount: 3 }]) {
    const body = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x' }] } }], usageMetadata: bad })}\n\n`;
    const usage = await withFetch(body, () => new GeminiProvider('key', 'm', 100).stream('s', 'u', () => undefined));
    assert.equal(usage, undefined, JSON.stringify(bad));
  }
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
