import type { Provider } from './provider';
import { MockProvider } from './mock';
import { GeminiProvider } from './gemini';

export { buildSystemPrompt, buildUserPrompt, buildComprehensionPrompt } from './prompt';
export type { Provider, ModelProvider, ModelRoute } from './provider';
export type { SpeechToTextProvider, TextToSpeechProvider, EmbeddingProvider } from './speech';
export {
  DEFAULT_OPENROUTER_MODEL,
  FREE_CHAT_MODELS,
  listFreeChatModels,
  normalizeOpenRouterModel,
} from './openrouterModels';

/**
 * Consent and the privacy policy name Google Gemini. Never fall back to another
 * provider, even when other API keys or a payload model are present.
 * The labelled mock is an explicit development-only opt-in.
 */
export function selectProvider(): Provider | null {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AI === 'true') return new MockProvider();
  const gemini = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  return gemini ? new GeminiProvider(gemini) : null;
}
