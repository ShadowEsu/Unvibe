import type { Provider } from './provider.js';

/**
 * Deterministic offline provider. Used when ANTHROPIC_API_KEY is not set so the full pipeline
 * (extension -> service -> SSE -> panel) is exercisable without a key. Output is always clearly
 * labelled as mock — it is never presented as a real analysis.
 */
export class MockProvider implements Provider {
  readonly name = 'mock';
  readonly mock = true;

  async stream(
    _system: string,
    user: string,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const fileMatch = /Primary file: (.+)/.exec(user);
    const langMatch = /Language: (.+)/.exec(user);
    const file = fileMatch?.[1]?.trim() ?? 'this code';
    const lang = langMatch?.[1]?.trim() ?? 'unknown';

    const text =
      `[MOCK EXPLANATION — no ANTHROPIC_API_KEY set on the Uncode service]\n\n` +
      `Visible: the request concerns ${file} (${lang}). The service received the constructed ` +
      `context (imports, diff/selection, project structure) and would normally send it to Claude.\n\n` +
      `Inferred: with a real key, you'd get a levelled explanation here that distinguishes what ` +
      `the code shows from what is inferred, cites file:line, and ends with what would break if ` +
      `the code were removed.\n\n` +
      `Uncertain: nothing further can be said without the model.\n\n` +
      `To enable real analysis: set ANTHROPIC_API_KEY in the service environment and restart.`;

    for (const chunk of text.match(/.{1,24}/gs) ?? []) {
      if (signal?.aborted) {
        return;
      }
      onToken(chunk);
      await delay(12);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
