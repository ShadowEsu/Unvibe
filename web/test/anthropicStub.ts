/**
 * Local stand-ins for Anthropic's Messages API (POST https://api.anthropic.com/v1/messages), so route
 * tests exercise the real AnthropicProvider and spend meter with only the HTTP boundary replaced.
 * Wire format: https://docs.anthropic.com/en/api/messages and .../messages-streaming.
 */
export const ANTHROPIC_HOST = 'api.anthropic.com';

export type StubUsage = { input_tokens: number; output_tokens: number };
export const STUB_USAGE: StubUsage = { input_tokens: 120, output_tokens: 40 };

/** The reviews route streams; comprehension and Try ask for one whole message. */
export function wantsStream(init?: RequestInit): boolean {
  const body: unknown = JSON.parse(String(init?.body));
  return typeof body === 'object' && body !== null && 'stream' in body && body.stream === true;
}

/**
 * SSE text for a streamed answer: one text delta per non-empty entry of `texts`. With `usage`,
 * message_start carries the input count and message_delta the output total, as Anthropic sends them;
 * `usage: null` reports none. `finished: false` stops after the deltas, like a stream still open.
 */
export function streamBody(texts: string[], usage: StubUsage | null = STUB_USAGE, finished = true): string {
  const events: Array<{ type: string } & Record<string, unknown>> = [
    { type: 'message_start', message: usage ? { usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } : {} },
    ...texts.filter(Boolean).map((text) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
  ];
  if (finished) {
    events.push(
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, ...(usage ? { usage: { output_tokens: usage.output_tokens } } : {}) },
      { type: 'message_stop' },
    );
  }
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
}

export function anthropicStream(texts: string[], usage: StubUsage | null = STUB_USAGE): Response {
  return new Response(streamBody(texts, usage), { headers: { 'content-type': 'text/event-stream' } });
}

/** A whole non-streamed answer; `usage: null` reports none. */
export function anthropicMessage(text: string, usage: StubUsage | null = STUB_USAGE): Response {
  return Response.json({ content: [{ type: 'text', text }], stop_reason: 'end_turn', ...(usage ? { usage } : {}) });
}

/** `text` in whichever shape the request asked for. */
export function anthropicAnswer(init: RequestInit | undefined, text: string, usage: StubUsage | null = STUB_USAGE): Response {
  return wantsStream(init) ? anthropicStream([text], usage) : anthropicMessage(text, usage);
}

/** Anthropic's error body: `{"type":"error","error":{"type":…,"message":…}}`. */
export function anthropicError(status = 529, type = 'overloaded_error', message = 'Overloaded'): Response {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), { status, headers: { 'content-type': 'application/json' } });
}

/** PostgREST answers for the spend meter's RPCs, or null for any other path. */
export function spendMeterRpc(url: URL): Response | null {
  if (url.pathname === '/rest/v1/rpc/reserve_ai_spend') return Response.json([{ status: 'ok', day: '2026-10-29' }]);
  if (url.pathname === '/rest/v1/rpc/settle_ai_spend') return new Response(null, { status: 204 });
  return null;
}
