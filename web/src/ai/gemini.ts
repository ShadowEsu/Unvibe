import type { Provider } from './provider';

type GeminiPart = { text?: string; thought?: boolean };
type GeminiChunk = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
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
  ): Promise<void> {
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

    // Read the stream as it arrives so the first words show in well under a second, instead of
    // waiting for the whole answer. A gateway that drops alt=sse sends one JSON array instead;
    // that case is parsed once the body ends.
    let emitted = 0;
    let buffer = '';
    let arrayBody = false;
    const emit = (text: string | undefined) => {
      if (!text) return;
      onToken(text);
      emitted += text.length;
    };
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
          emit(extractDelta(event));
        }
      }
      buffer += decoder.decode();
    } else {
      buffer = await res.text();
      arrayBody = buffer.trimStart().startsWith('[');
    }

    if (arrayBody) {
      try {
        for (const chunk of JSON.parse(buffer) as GeminiChunk[]) emit(textFromChunk(chunk));
      } catch {
        /* not a JSON array after all; the SSE pass below handles it */
      }
    }
    if (emitted === 0 || !arrayBody) {
      for (const event of splitSseEvents(buffer)) emit(extractDelta(event));
    }

    // If stream produced nothing (common when thinking ate the budget), fall back.
    if (emitted === 0) {
      const full = await this.complete(system, user, signal);
      if (full) onToken(full);
    }
  }

  async complete(system: string, user: string, signal?: AbortSignal): Promise<string> {
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
    const data = (await res.json()) as GeminiChunk;
    return textFromChunk(data);
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

function splitSseEvents(raw: string): string[] {
  return raw.split(/\r?\n\r?\n/).filter((e) => e.trim().length > 0);
}

function extractDelta(rawEvent: string): string | undefined {
  for (const line of rawEvent.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const json = line.slice(5).trim();
    if (!json || json === '[DONE]') continue;
    try {
      const text = textFromChunk(JSON.parse(json) as GeminiChunk);
      return text || undefined;
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
