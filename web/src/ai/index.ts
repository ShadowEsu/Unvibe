import type { Provider } from './provider';
import { MockProvider } from './mock';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';
import { normalizeOpenRouterModel } from './openrouterModels';

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
 * Provider selection:
 * 1. OPENROUTER_API_KEY → free OpenRouter chat models (default for every downloader)
 * 2. ANTHROPIC_API_KEY → Claude
 * 3. GEMINI_API_KEY / GOOGLE_API_KEY → Gemini
 * 4. else labelled mock
 */
export function selectProvider(modelId?: string | null): Provider {
  if (process.env.ENABLE_MOCK_AI === 'true') return new MockProvider();

  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouter) {
    return new OpenRouterProvider(openrouter, normalizeOpenRouterModel(modelId));
  }

  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropic) return new AnthropicProvider(anthropic);

  const gemini =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  if (gemini) return new GeminiProvider(gemini);

  return new MockProvider();
}
