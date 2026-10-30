import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ANTHROPIC_MAX_TOKENS, ANTHROPIC_MODEL, AnthropicProvider, TRUNCATED_NOTE } from '../src/ai/anthropic';
import { BilledProviderError, ProviderRejectedError, billedUsage, providerErrorSummary } from '../src/ai/provider';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const FAKE_KEY = 'sk-ant-api03-FAKEFAKEFAKEFAKEFAKEFAKE';

function sse(events: unknown[]): string {
  return events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
}

const start = (input: number, extra: Record<string, number> = {}) => ({ type: 'message_start', message: { usage: { input_tokens: input, output_tokens: 1, ...extra } } });
const text = (t: string) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } });
const end = (output: number, stop = 'end_turn') => ({ type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: output } });

/** A body that arrives in separate network chunks, so tokens must be emitted before the stream ends. */
function chunked(parts: string[], onPull?: (i: number) => void): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      onPull?.(i);
      if (i < parts.length) controller.enqueue(new TextEncoder().encode(parts[i++]));
      else controller.close();
    },
  });
}

test('stream emits each text delta as it arrives and returns the measured usage, cache tokens included', async () => {
  const got: string[] = [];
  const events = [start(900, { cache_creation_input_tokens: 50, cache_read_input_tokens: 25 }), text('Hel'), text('lo'), end(42), { type: 'message_stop' }];
  // Every event split in half across two network chunks, so the parser must buffer partial events.
  const parts = events.map((e) => sse([e])).flatMap((s) => [s.slice(0, s.length >> 1), s.slice(s.length >> 1)]);
  const seenBeforeChunk: number[] = [];
  globalThis.fetch = (async () => new Response(chunked(parts, () => seenBeforeChunk.push(got.length)))) as typeof fetch;
  const usage = await new AnthropicProvider(FAKE_KEY).stream('s', 'u', (t) => got.push(t));
  assert.deepEqual(got, ['Hel', 'lo']);
  assert.ok(seenBeforeChunk.some((n) => n > 0 && n < 2), 'a token was emitted before the last chunk arrived');
  assert.deepEqual(usage, { inputTokens: 975, outputTokens: 42 });
});

test('stream ignores blocks that are not text', async () => {
  const got: string[] = [];
  globalThis.fetch = (async () => new Response(sse([
    start(10),
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'x', name: 'send_email', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"to":"a@evil.example"}' } },
    text('Only this.'),
    end(5),
  ]))) as typeof fetch;
  await new AnthropicProvider(FAKE_KEY).stream('s', 'u', (t) => got.push(t));
  assert.deepEqual(got, ['Only this.']);
});

test('an answer cut off at max_tokens is labelled, once, in stream and complete', async () => {
  const got: string[] = [];
  globalThis.fetch = (async () => new Response(sse([start(10), text('Part of an answer'), end(ANTHROPIC_MAX_TOKENS, 'max_tokens')]))) as typeof fetch;
  await new AnthropicProvider(FAKE_KEY).stream('s', 'u', (t) => got.push(t));
  assert.deepEqual(got, ['Part of an answer', TRUNCATED_NOTE]);

  globalThis.fetch = (async () => Response.json({ content: [{ type: 'text', text: 'Part' }], stop_reason: 'max_tokens', usage: { input_tokens: 10, output_tokens: 2048 } })) as typeof fetch;
  const { text: full } = await new AnthropicProvider(FAKE_KEY).complete('s', 'u');
  assert.equal(full, `Part${TRUNCATED_NOTE}`);
});

test('the request pins the metered model and output budget, with the system prompt kept apart from the user text', async () => {
  let body: Record<string, unknown> = {};
  let headers = new Headers();
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    headers = new Headers(init?.headers);
    return Response.json({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 1 } });
  }) as typeof fetch;
  await new AnthropicProvider(FAKE_KEY).complete('SYSTEM', 'USER');
  assert.equal(body.model, ANTHROPIC_MODEL);
  assert.equal(body.max_tokens, ANTHROPIC_MAX_TOKENS);
  assert.ok(ANTHROPIC_MAX_TOKENS <= 2048);
  assert.equal(body.system, 'SYSTEM');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'USER' }]);
  assert.equal(body.tools, undefined);
  assert.equal(headers.get('x-api-key'), FAKE_KEY);
});

test('complete joins text blocks only and returns measured usage', async () => {
  globalThis.fetch = (async () => Response.json({
    content: [{ type: 'text', text: 'A' }, { type: 'tool_use', id: 't', name: 'x', input: {} }, { type: 'text', text: 'B' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 7, output_tokens: 3 },
  })) as typeof fetch;
  assert.deepEqual(await new AnthropicProvider(FAKE_KEY).complete('s', 'u'), { text: 'AB', usage: { inputTokens: 7, outputTokens: 3 } });
});

test('an HTTP error keeps only status and error type; the body text and the key never reach the message or the log summary', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: `invalid x-api-key ${FAKE_KEY}` } }), { status: 401 })) as typeof fetch;
  const error = await new AnthropicProvider(FAKE_KEY).complete('s', 'u').catch((e: unknown) => e);
  assert.ok(error instanceof ProviderRejectedError);
  assert.equal(error.status, 401);
  assert.equal(error.message, 'Anthropic API 401: authentication_error');
  assert.equal(providerErrorSummary(error), 'ProviderRejectedError: Anthropic API 401: authentication_error');

  globalThis.fetch = (async () => new Response('<html>upstream said sk-ant-api03-LEAK</html>', { status: 502 })) as typeof fetch;
  const opaque = await new AnthropicProvider(FAKE_KEY).stream('s', 'u', () => {}).catch((e: unknown) => e);
  assert.equal((opaque as Error).message, 'Anthropic API 502: error');
});

test('the request never follows a redirect, so the key only ever goes to api.anthropic.com', async () => {
  let init: RequestInit | undefined;
  globalThis.fetch = (async (url: RequestInfo | URL, options?: RequestInit) => {
    init = options;
    assert.equal(String(url), 'https://api.anthropic.com/v1/messages');
    return Response.json({ content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } });
  }) as typeof fetch;
  await new AnthropicProvider(FAKE_KEY).complete('s', 'u');
  assert.equal(init?.redirect, 'error');
});

test('a network error is summarised to its class, so a message quoting a key is never logged', () => {
  const error = new TypeError(`fetch failed: header x-api-key: ${FAKE_KEY}`);
  assert.equal(providerErrorSummary(error), 'TypeError');
  assert.equal(providerErrorSummary(new BilledProviderError(error, { inputTokens: 1, outputTokens: 0, estimated: true })), 'TypeError');
});

test('a mid-stream error event or a dropped connection fails as billed, with an estimate', async () => {
  globalThis.fetch = (async () => new Response(sse([start(10), text('Half'), { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]))) as typeof fetch;
  const error = await new AnthropicProvider(FAKE_KEY).stream('ssss', 'uuuu', () => {}).catch((e: unknown) => e);
  assert.ok(error instanceof BilledProviderError);
  assert.equal(error.message, 'Anthropic API stream error: overloaded_error');
  assert.deepEqual(billedUsage(error), { inputTokens: 2, outputTokens: 1, estimated: true });

  globalThis.fetch = (async () => new Response(new ReadableStream({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode(sse([start(10), text('Half')])));
      controller.error(new Error('socket hang up'));
    },
  }))) as typeof fetch;
  const dropped = await new AnthropicProvider(FAKE_KEY).stream('s', 'u', () => {}).catch((e: unknown) => e);
  assert.ok(dropped instanceof BilledProviderError);
  assert.equal(billedUsage(dropped)?.estimated, true);
});

test('a stream without usage events returns an estimate, never measured-looking counts', async () => {
  globalThis.fetch = (async () => new Response(sse([text('12345678')]))) as typeof fetch;
  const usage = await new AnthropicProvider(FAKE_KEY).stream('ssss', 'uuuu', () => {});
  assert.deepEqual(usage, { inputTokens: 2, outputTokens: 2, estimated: true });
});
