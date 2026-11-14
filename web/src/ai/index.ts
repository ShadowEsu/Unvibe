import type { Provider } from './provider';
import { MockProvider } from './mock';
import { AnthropicProvider, SHORT_MAX_TOKENS } from './anthropic';
import { MeteredProvider, spendStore } from './spendMeter';

export { buildSystemPrompt, buildUserPrompt, buildComprehensionPrompt, buildPreviewSystemPrompt, buildPreviewUserPrompt, isMoreDetail, isShortExplanation } from './prompt';
export type { Provider, ModelProvider, ModelRoute } from './provider';
export type { SpeechToTextProvider, TextToSpeechProvider, EmbeddingProvider } from './speech';

/**
 * Consent and the privacy policy name Anthropic's Claude API. Never fall back to another
 * provider, even when other API keys or a payload model are present: past a spend stop the call
 * is refused (AiPausedError), not sent elsewhere. `account` (from `spendAccount`) makes each call
 * count against that account's daily share too; the website's Try box has none. `maxOutputTokens`
 * lowers the output budget (and so the meter's hold) for short answers.
 * The labelled mock is an explicit development-only opt-in.
 */
export function selectProvider(account?: string, maxOutputTokens?: number): Provider | null {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AI === 'true') return new MockProvider();
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? new MeteredProvider(new AnthropicProvider(key, maxOutputTokens), spendStore(), account) : null;
}

/**
 * Quick look (previews): the same provider and meter as `selectProvider`, with the output budget fixed
 * at SHORT_MAX_TOKENS here (no request field reaches it) and the preview allowance checked on top of
 * the caps (`MeteredProvider` with kind 'ai_preview'). Without `account` every hosted call is refused.
 */
export function selectPreviewProvider(account: string | undefined): Provider | null {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AI === 'true') return new MockProvider();
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? new MeteredProvider(new AnthropicProvider(key, SHORT_MAX_TOKENS), spendStore(), account, 'ai_preview') : null;
}
