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
