import type { Provider } from './provider';
import { MockProvider } from './mock';
import { AnthropicProvider } from './anthropic';

export { buildSystemPrompt, buildUserPrompt, buildComprehensionPrompt } from './prompt';
export type { Provider } from './provider';

/** Real provider when ANTHROPIC_API_KEY is set, else the labelled mock. */
export function selectProvider(): Provider {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new AnthropicProvider(key) : new MockProvider();
}
