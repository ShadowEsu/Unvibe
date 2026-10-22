/** Provider abstraction so the model can be swapped without touching the server or extension. */
export type ModelProvider = Provider;
export type ModelRoute = 'LOCAL' | 'CLOUD' | 'BYOK';

/**
 * Token counts the model provider reported for one request. Counts only: never prompt, code or
 * answer text. `outputTokens` includes hidden thinking tokens, which are billed as output.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface Completion {
  text: string;
  /** Undefined when the provider did not report usage. */
  usage?: TokenUsage;
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
