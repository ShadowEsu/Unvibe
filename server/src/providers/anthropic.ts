import type { Provider } from './provider.js';

/**
 * Anthropic provider via the Messages API with streaming. Uses plain fetch (no SDK dependency)
 * so the service stays dependency-free. Anthropic does not train on API inputs by default
 * (see docs/privacy.md).
 */
export class AnthropicProvider implements Provider {
  readonly name: string;
  readonly mock = false;

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.UNCODE_MODEL ?? 'claude-sonnet-5',
    private readonly maxTokens = Number(process.env.UNCODE_MAX_TOKENS ?? 1024),
  ) {
    this.name = `anthropic:${this.model}`;
  }

  async stream(
    system: string,
    user: string,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        stream: true,
        messages: [{ role: 'user', content: user }],
      }),
      signal,
    });

    if (!res.ok || !res.body) {
      const detail = await safeText(res);
      throw new Error(`Anthropic API ${res.status}: ${detail}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const text = extractDelta(rawEvent);
        if (text) {
          onToken(text);
        }
      }
    }
  }

  async complete(system: string, user: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await safeText(res)}`);
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return (data.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  }
}

/** Pull text out of a `content_block_delta` SSE event from the Anthropic stream. */
function extractDelta(rawEvent: string): string | undefined {
  for (const line of rawEvent.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      const json = line.slice(5).trim();
      if (!json || json === '[DONE]') {
        continue;
      }
      try {
        const obj = JSON.parse(json);
        if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta') {
          return obj.delta.text as string;
        }
      } catch {
        return undefined;
      }
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
