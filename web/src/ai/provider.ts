/** Provider abstraction so the model can be swapped without touching the server or extension. */
export type ModelProvider = Provider;
export type ModelRoute = 'LOCAL' | 'CLOUD' | 'BYOK';

/**
 * Token counts for one request. Counts only: never prompt, code or answer text. `outputTokens`
 * includes hidden thinking tokens, which are billed as output. `estimated` is set when the provider
 * answered but reported no usage, so the counts are chars/4 of the prompt and of what was delivered
 * (a rough rule of thumb for English and code); measured counts never carry it.
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

/** chars/4, rounded up: a rough tokens-per-character rule of thumb. */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

/** Our own provider errors: fixed text with an HTTP status and Anthropic's error type at most. */
const OWN_PROVIDER_MESSAGE = /^Anthropic API (\d{3}: [a-z_]{1,60}|stream error: [a-z_]{1,60}|stream had no body)$/;

/**
 * What may be logged about a failed provider call: the error's class, plus its message only when it
 * is one of ours. Anything else (network errors, SDK or runtime messages) could quote a request,
 * a header or a key, so it is reduced to the class name.
 */
export function providerErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const name = /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : 'Error';
  return OWN_PROVIDER_MESSAGE.test(error.message) ? `${name}: ${error.message}` : name;
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

/**
 * The provider answered with an error status before doing any work (auth, rate limit, overload,
 * bad request). Such a request is not billed, so the spend meter releases its hold.
 */
export class ProviderRejectedError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ProviderRejectedError';
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
