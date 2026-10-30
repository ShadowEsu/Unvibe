import type { Provider } from './provider';
import { MockProvider } from './mock';
import { AnthropicProvider } from './anthropic';
import { MeteredProvider, spendStore } from './spendMeter';

export { buildSystemPrompt, buildUserPrompt, buildComprehensionPrompt } from './prompt';
export type { Provider, ModelProvider, ModelRoute } from './provider';
export type { SpeechToTextProvider, TextToSpeechProvider, EmbeddingProvider } from './speech';

/**
 * Consent and the privacy policy name Anthropic's Claude API. Never fall back to another
 * provider, even when other API keys or a payload model are present: past a spend stop the call
 * is refused (AiPausedError), not sent elsewhere.
 * The labelled mock is an explicit development-only opt-in.
 */
export function selectProvider(): Provider | null {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AI === 'true') return new MockProvider();
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? new MeteredProvider(new AnthropicProvider(key), spendStore()) : null;
}
