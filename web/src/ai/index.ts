import type { Provider } from './provider';
import { MockProvider } from './mock';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';

export { buildSystemPrompt, buildUserPrompt, buildComprehensionPrompt } from './prompt';
export type { Provider } from './provider';

/**
 * Provider selection:
 * 1. ANTHROPIC_API_KEY → Claude
 * 2. GEMINI_API_KEY / GOOGLE_API_KEY → Gemini (AI Studio keys often start with AQ.)
 * 3. else labelled mock
 */
export function selectProvider(): Provider {
  // Local demos / consumer walkthroughs can force the labelled mock even when keys exist.
  if (process.env.ENABLE_MOCK_AI === 'true') return new MockProvider();

  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) return new AnthropicProvider(anthropic);

  const gemini =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  if (gemini) return new GeminiProvider(gemini);

  return new MockProvider();
}
