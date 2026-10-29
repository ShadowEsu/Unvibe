import { BilledProviderError, estimateTokens, type Completion, type TokenUsage } from './provider';
import type { MeterableProvider } from './spendMeter';

/** The spend meter's prices are for this model; changing it means changing them too. */
export const ANTHROPIC_MODEL = 'claude-haiku-5-5';
/** Output budget per call; the meter reserves all of it before each call. */
export const ANTHROPIC_MAX_TOKENS = 2048;
/** Shown after an answer that hit the output budget, so a cut-off answer never looks finished. */
export const TRUNCATED_NOTE = '\n\n(This answer was cut off at the length limit.)';

const API_URL = 'https://api.anthropic.com/v1/messages';

/** https://docs.anthropic.com/en/api/messages (usage fields). */
type AnthropicUsage = {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
};

type AnthropicEvent = {
  type?: string;
  message?: { usage?: AnthropicUsage };
  delta?: { type?: string; text?: unknown; stop_reason?: unknown };
  usage?: AnthropicUsage;
  error?: { type?: unknown };
};

type AnthropicMessage = {
  content?: Array<{ type?: string; text?: unknown }>;
  stop_reason?: unknown;
  usage?: AnthropicUsage;
};

/**
 * Anthropic Messages API provider (Claude Haiku 5.5), streaming over SSE.
 * Errors carry only the HTTP status and Anthropic's error type: never the response body, the
 * request or its headers, so the key can't reach a log or a response. No retries: a second call
 * would spend again.
 */
export class AnthropicProvider implements MeterableProvider {
  readonly name = `anthropic:${ANTHROPIC_MODEL}`;
  readonly mock = false;
  readonly maxOutputTokens = ANTHROPIC_MAX_TOKENS;

  constructor(private readonly apiKey: string) {}

  async stream(
    system: string,
    user: string,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<TokenUsage | undefined> {
    const res = await this.post(system, user, true, signal);

    // Anthropic accepted the request, so from here it is billed: a failure below carries an
    // estimate (BilledProviderError), and the meter keeps its worst-case reservation for it.
    let emitted = 0;
    let input: number | undefined;
    let output: number | undefined;
    let stopReason: unknown;
    let failure: string | undefined;
    const take = (event: AnthropicEvent | undefined) => {
      if (!event) return;
      switch (event.type) {
        case 'message_start':
          input = inputTokens(event.message?.usage) ?? input;
          output = tokenCount(event.message?.usage?.output_tokens) ?? output;
          break;
        case 'content_block_delta':
          // Text only: no tools are offered, so any other block type is ignored.
          if (event.delta?.type === 'text_delta' && typeof event.delta.text === 'string' && event.delta.text) {
            onToken(event.delta.text);
            emitted += event.delta.text.length;
          }
          break;
        case 'message_delta':
          // Output counts here are cumulative; the last one is the total.
          output = tokenCount(event.usage?.output_tokens) ?? output;
          input = inputTokens(event.usage) ?? input;
          if (event.delta?.stop_reason !== undefined) stopReason = event.delta.stop_reason;
          break;
        case 'error':
          failure = typeof event.error?.type === 'string' ? event.error.type : 'stream_error';
          break;
      }
    };

    try {
      if (!res.body) throw new Error('Anthropic API stream had no body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let match: RegExpExecArray | null;
        while ((match = /\r?\n\r?\n/.exec(buffer))) {
          take(eventFromSse(buffer.slice(0, match.index)));
          buffer = buffer.slice(match.index + match[0].length);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) take(eventFromSse(buffer));
      if (failure) throw new Error(`Anthropic API stream error: ${failure}`);
    } catch (error) {
      // Cut off midway (client abort, dropped connection, overloaded mid-stream): estimate.
      throw new BilledProviderError(error, estimate(system, user, emitted));
    }

    if (stopReason === 'max_tokens' && emitted > 0) onToken(TRUNCATED_NOTE);
    return input !== undefined && output !== undefined ? { inputTokens: input, outputTokens: output } : estimate(system, user, emitted);
  }

  async complete(system: string, user: string, signal?: AbortSignal): Promise<Completion> {
    const res = await this.post(system, user, false, signal);
    let data: AnthropicMessage;
    try {
      data = (await res.json()) as AnthropicMessage;
    } catch (error) {
      throw new BilledProviderError(error, estimate(system, user, 0));
    }
    let text = (Array.isArray(data.content) ? data.content : [])
      .map((block) => (block?.type === 'text' && typeof block.text === 'string' ? block.text : ''))
      .join('');
    if (data.stop_reason === 'max_tokens' && text) text += TRUNCATED_NOTE;
    const input = inputTokens(data.usage);
    const output = tokenCount(data.usage?.output_tokens);
    return {
      text,
      usage: input !== undefined && output !== undefined ? { inputTokens: input, outputTokens: output } : estimate(system, user, text.length),
    };
  }

  private async post(system: string, user: string, stream: boolean, signal?: AbortSignal): Promise<Response> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
        stream,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await errorType(res)}`);
    return res;
  }
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/**
 * Billed input: plain input plus any cache writes and reads. The app sends no cache_control, so the
 * cache counts are 0; if they ever appear they are counted at the full input price.
 */
function inputTokens(usage: AnthropicUsage | undefined): number | undefined {
  const plain = tokenCount(usage?.input_tokens);
  if (plain === undefined) return undefined;
  return plain + (tokenCount(usage?.cache_creation_input_tokens) ?? 0) + (tokenCount(usage?.cache_read_input_tokens) ?? 0);
}

/** chars/4 of the prompt sent and of the answer text delivered, marked as an estimate. */
function estimate(system: string, user: string, deliveredChars: number): TokenUsage {
  return { inputTokens: estimateTokens(system.length + user.length), outputTokens: estimateTokens(deliveredChars), estimated: true };
}

function eventFromSse(rawEvent: string): AnthropicEvent | undefined {
  const data = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data) return undefined;
  try {
    const parsed: unknown = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? (parsed as AnthropicEvent) : undefined;
  } catch {
    return undefined;
  }
}

/** Anthropic's error type (e.g. "overloaded_error"), never the message or body. */
async function errorType(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { type?: unknown } };
    const type = body?.error?.type;
    return typeof type === 'string' && /^[a-z_]{1,60}$/.test(type) ? type : 'error';
  } catch {
    return 'error';
  }
}
