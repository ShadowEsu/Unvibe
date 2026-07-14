import type { Provider } from './provider';

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

    const cite = file !== 'this code' ? `[[cite:${file}:1]]` : '';
    const text =
      `[MOCK EXPLANATION — no AI API key set on the Unvibe service]\n\n` +
      `Visible: the request concerns ${cite} (${lang}). The service received the constructed ` +
      `context (imports, diff/selection, project structure) and would normally send it to Claude.\n\n` +
      `Inferred: with a real key, you'd get a levelled explanation here that distinguishes what ` +
      `the code shows from what is inferred, cites references like ${cite}, and ends with what ` +
      `would break if the code were removed.\n\n` +
      `Uncertain: nothing further can be said without the model.\n\n` +
      `To enable real analysis: set GEMINI_API_KEY or ANTHROPIC_API_KEY in web/.env.local and restart.`;

    for (const chunk of text.match(/.{1,24}/gs) ?? []) {
      if (signal?.aborted) {
        return;
      }
      onToken(chunk);
      await delay(12);
    }
  }

  async complete(_system: string, user: string): Promise<string> {
    const file = /Primary file: (.+)/.exec(user)?.[1]?.trim() ?? 'this code';
    const lang = /Language: (.+)/.exec(user)?.[1]?.trim() ?? 'code';
    // Returns a deterministic, clearly-mock multiple-choice question as JSON.
    return JSON.stringify({
      question: `(Mock question) What is the most accurate description of ${file}?`,
      options: [
        `It is ${lang} code whose purpose you just reviewed`,
        'It is an unrelated configuration file',
        'It is compiled binary output',
        'It is documentation only',
      ],
      answerIndex: 0,
      rationale: '(Mock) With a real ANTHROPIC_API_KEY the question would test the specific behaviour of the reviewed code.',
      concept: 'code-comprehension',
      conceptLabel: 'Code comprehension',
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
