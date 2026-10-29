import type { Completion, Provider, TokenUsage } from './provider';

/**
 * Deterministic offline provider, explicitly enabled outside production with
 * ENABLE_MOCK_AI=true. Output is always clearly labelled as mock.
 */
export class MockProvider implements Provider {
  readonly name = 'mock';
  readonly mock = true;

  async stream(
    _system: string,
    user: string,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<TokenUsage | undefined> {
    const fileMatch = /Primary file: (.+)/.exec(user);
    const langMatch = /Language: (.+)/.exec(user);
    const file = fileMatch?.[1]?.trim() ?? 'this code';
    const lang = langMatch?.[1]?.trim() ?? 'unknown';

    const cite = file !== 'this code' ? `[[cite:${file}:1]]` : '';
    const text =
      `[MOCK EXPLANATION: development mock is enabled]\n\n` +
      `Visible: the request concerns ${cite} (${lang}). The service received the constructed ` +
      `context (imports, diff/selection, project structure) and would normally send it to Google Gemini.\n\n` +
      `Inferred: with a real key, you'd get a levelled explanation here that distinguishes what ` +
      `the code shows from what is inferred, cites references like ${cite}, and ends with what ` +
      `would break if the code were removed.\n\n` +
      `Uncertain: nothing further can be said without the model.\n\n` +
      `To enable real analysis: set GEMINI_API_KEY in web/.env.local, turn off ENABLE_MOCK_AI, and restart.`;

    for (const chunk of text.match(/.{1,24}/gs) ?? []) {
      if (signal?.aborted) {
        return undefined;
      }
      onToken(chunk);
      await delay(12);
    }
    return undefined;
  }

  async complete(_system: string, user: string): Promise<Completion> {
    const file = /Primary file: (.+)/.exec(user)?.[1]?.trim() ?? 'this code';
    const lang = /Language: (.+)/.exec(user)?.[1]?.trim() ?? 'code';
    // Returns a deterministic, clearly-mock multiple-choice question as JSON.
    const text = JSON.stringify({
      question: `(Mock question) What is the most accurate description of ${file}?`,
      options: [
        `It is ${lang} code whose purpose you just reviewed`,
        'It is an unrelated configuration file',
        'It is compiled binary output',
        'It is documentation only',
      ],
      answerIndex: 0,
      rationale: '(Mock) With a real GEMINI_API_KEY the question would test the specific behaviour of the reviewed code.',
      concept: 'code-comprehension',
      conceptLabel: 'Code comprehension',
    });
    return { text };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
