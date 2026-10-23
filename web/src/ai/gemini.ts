import { BilledProviderError, billedUsage, estimateTokens, type Completion, type Provider, type TokenUsage } from './provider';

type GeminiPart = { text?: string; thought?: boolean };
/** https://ai.google.dev/api/generate-content#UsageMetadata (only the fields we bill by). */
type GeminiUsageMetadata = {
  promptTokenCount?: unknown;
  candidatesTokenCount?: unknown;
  thoughtsTokenCount?: unknown;
};
type GeminiChunk = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  usageMetadata?: GeminiUsageMetadata;
};

/**
 * Google Gemini provider via the native generateContent streaming API.
 * Keys from AI Studio now often start with AQ. (Auth keys).
 */
export class GeminiProvider implements Provider {
  readonly name: string;
  readonly mock = false;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    private readonly maxTokens = Number(
      process.env.AI_MAX_TOKENS || process.env.UNCODE_MAX_TOKENS || 2048,
    ),
  ) {
    this.name = `gemini:${this.model}`;
  }

  async stream(
    system: string,
    user: string,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<TokenUsage | undefined> {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent`,
    );
    url.searchParams.set('alt', 'sse');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(buildBody(system, user, this.maxTokens)),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await safeText(res)}`);
    }

    // Gemini accepted the request, so from here it may be billed: a failure below carries an
    // estimate (BilledProviderError) instead of losing the cost.
    // Read the stream as it arrives so the first words show in well under a second, instead of
    // waiting for the whole answer. A gateway that drops alt=sse sends one JSON array instead;
    // that case is parsed once the body ends.
    let emitted = 0;
    let buffer = '';
    let arrayBody = false;
    // Gemini repeats usageMetadata on chunks; the last one seen holds the totals.
    let usage: TokenUsage | undefined;
    const emit = (text: string | undefined) => {
      if (!text) return;
      onToken(text);
      emitted += text.length;
    };
    const take = (chunk: GeminiChunk | undefined) => {
      if (!chunk) return;
      usage = usageFromChunk(chunk) ?? usage;
      emit(textFromChunk(chunk));
    };
    try {
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (!arrayBody && buffer.trimStart().startsWith('[')) arrayBody = true;
          if (arrayBody) continue;
          let match: RegExpExecArray | null;
          while ((match = /\r?\n\r?\n/.exec(buffer))) {
            const event = buffer.slice(0, match.index);
            buffer = buffer.slice(match.index + match[0].length);
            take(chunkFromEvent(event));
          }
        }
        buffer += decoder.decode();
      } else {
        buffer = await res.text();
        arrayBody = buffer.trimStart().startsWith('[');
      }
    } catch (error) {
      // Cut off midway (client abort, dropped connection): no final totals, so estimate.
      throw new BilledProviderError(error, estimate(system, user, emitted));
    }

    if (arrayBody) {
      try {
        for (const chunk of JSON.parse(buffer) as GeminiChunk[]) take(chunk);
      } catch {
        /* not a JSON array after all; the SSE pass below handles it */
      }
    }
    if (emitted === 0 || !arrayBody) {
      for (const event of splitSseEvents(buffer)) take(chunkFromEvent(event));
    }
    const streamed = usage ?? estimate(system, user, emitted);

    // If stream produced nothing (common when thinking ate the budget), fall back. Both calls are
    // billed, so their counts add up.
    if (emitted === 0) {
      let full: Completion;
      try {
        full = await this.complete(system, user, signal);
      } catch (error) {
        const second = billedUsage(error);
        throw new BilledProviderError(error, second ? addUsage(streamed, second) : streamed);
      }
      if (full.text) onToken(full.text);
      return full.usage ? addUsage(streamed, full.usage) : streamed;
    }
    return streamed;
  }

  async complete(system: string, user: string, signal?: AbortSignal): Promise<Completion> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(buildBody(system, user, this.maxTokens)),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await safeText(res)}`);
    }
    let data: GeminiChunk;
    try {
      data = (await res.json()) as GeminiChunk;
    } catch (error) {
      throw new BilledProviderError(error, estimate(system, user, 0));
    }
    const text = textFromChunk(data);
    return { text, usage: usageFromChunk(data) ?? estimate(system, user, text.length) };
  }
}

function buildBody(system: string, user: string, maxTokens: number) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      // Gemini 2.5+ can spend the whole budget on hidden thinking and return no text.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

function textFromChunk(chunk: GeminiChunk): string {
  return (chunk.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/** Input and output (answer plus thinking) counts, or undefined unless both are valid. */
function usageFromChunk(chunk: GeminiChunk): TokenUsage | undefined {
  const meta = chunk.usageMetadata;
  if (!meta) return undefined;
  const input = tokenCount(meta.promptTokenCount);
  const answer = tokenCount(meta.candidatesTokenCount);
  const thoughts = meta.thoughtsTokenCount === undefined ? 0 : tokenCount(meta.thoughtsTokenCount);
  if (input === undefined || answer === undefined || thoughts === undefined) return undefined;
  return { inputTokens: input, outputTokens: answer + thoughts };
}

/** Two billed calls for one request. The sum is an estimate if either part is. */
function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  const sum = { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
  return a.estimated || b.estimated ? { ...sum, estimated: true } : sum;
}

/** chars/4 of the prompt sent and of the answer text delivered, marked as an estimate. */
function estimate(system: string, user: string, deliveredChars: number): TokenUsage {
  return { inputTokens: estimateTokens(system.length + user.length), outputTokens: estimateTokens(deliveredChars), estimated: true };
}

function splitSseEvents(raw: string): string[] {
  return raw.split(/\r?\n\r?\n/).filter((e) => e.trim().length > 0);
}

function chunkFromEvent(rawEvent: string): GeminiChunk | undefined {
  for (const line of rawEvent.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const json = line.slice(5).trim();
    if (!json || json === '[DONE]') continue;
    try {
      return JSON.parse(json) as GeminiChunk;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '(no body)';
  }
}
