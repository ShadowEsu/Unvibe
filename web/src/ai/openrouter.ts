/**
 * OpenRouter OpenAI-compatible provider. Company key stays server-side.
 * Free chat models only — see openrouterModels.ts.
 */
import type { Provider } from './provider';
import { DEFAULT_OPENROUTER_MODEL, normalizeOpenRouterModel } from './openrouterModels';

type OpenAiChunk = {
  choices?: Array<{ delta?: { content?: string | null }; message?: { content?: string | null } }>;
};

export class OpenRouterProvider implements Provider {
  readonly name: string;
  readonly mock = false;
  private readonly model: string;

  constructor(
    private readonly apiKey: string,
    model = process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
    private readonly maxTokens = Number(process.env.AI_MAX_TOKENS || process.env.UNCODE_MAX_TOKENS || 2048),
  ) {
    this.model = normalizeOpenRouterModel(model);
    this.name = `openrouter:${this.model}`;
  }

  async stream(
    system: string,
    user: string,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        stream: true,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`OpenRouter API ${res.status}: ${await safeText(res)}`);
    }
    if (!res.body) {
      throw new Error('OpenRouter returned an empty body.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let emitted = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) {
        const text = extractDelta(line);
        if (text) {
          onToken(text);
          emitted += text.length;
        }
      }
    }
    if (buffer.trim()) {
      const text = extractDelta(buffer);
      if (text) {
        onToken(text);
        emitted += text.length;
      }
    }

    if (emitted === 0) {
      const full = await this.complete(system, user, signal);
      if (full) onToken(full);
    }
  }

  async complete(system: string, user: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        stream: false,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`OpenRouter API ${res.status}: ${await safeText(res)}`);
    }
    const data = (await res.json()) as OpenAiChunk & {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  }

  private headers(): Record<string, string> {
    const referer = process.env.PUBLIC_APP_URL || process.env.WEB_BASE_URL || 'https://unvibe.site';
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`,
      'http-referer': referer,
      'x-title': 'Unvibe',
    };
  }
}

function extractDelta(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return '';
  const data = trimmed.slice(5).trim();
  if (!data || data === '[DONE]') return '';
  try {
    const parsed = JSON.parse(data) as OpenAiChunk;
    return parsed.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return res.statusText;
  }
}
