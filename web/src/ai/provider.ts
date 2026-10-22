/** Provider abstraction so the model can be swapped without touching the server or extension. */
export type ModelProvider = Provider;
export type ModelRoute = 'LOCAL' | 'CLOUD' | 'BYOK';

/**
 * Token counts for one request. Counts only: never prompt, code or answer text. `outputTokens`
 * includes hidden thinking tokens, which are billed as output. `estimated` is set when the provider
 * answered but reported no usage, so the counts are chars/4 of the prompt and of what was delivered
 * (https://ai.google.dev/gemini-api/docs/tokens); measured counts never carry it.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimated?: true;
}

export interface Completion {
  text: string;
  /** Undefined when the provider does not report usage. */
  usage?: TokenUsage;
}

/** chars/4, rounded up: Google's rule of thumb for Gemini tokens. */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

/**
 * A provider call that failed after the provider had accepted it (for example a stream cut off
 * midway), so it may still be billed. Same message and cause as the original failure.
 */
export class BilledProviderError extends Error {
  constructor(cause: unknown, readonly usage: TokenUsage) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = cause instanceof Error ? cause.name : 'BilledProviderError';
  }
}

/** The usage a failed provider call may still be billed for, or undefined if it never reached the provider. */
export function billedUsage(error: unknown): TokenUsage | undefined {
  return error instanceof BilledProviderError ? error.usage : undefined;
}

export interface Provider {
  readonly name: string;
  readonly mock: boolean;
  /**
   * Stream a completion. Calls `onToken` for each text chunk and resolves with the reported token
   * usage, or undefined when the provider gave none. Should reject on hard failure so the server can
   * emit an `error` event.
   */
  stream(
    system: string,
    user: string,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<TokenUsage | undefined>;

  /** Non-streaming completion: the full text plus usage. Used for structured JSON responses. */
  complete(system: string, user: string, signal?: AbortSignal): Promise<Completion>;
}
