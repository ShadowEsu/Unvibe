/** Provider abstraction so the model can be swapped without touching the server or extension. */
export interface Provider {
  readonly name: string;
  readonly mock: boolean;
  /**
   * Stream a completion. Calls `onToken` for each text chunk. Should reject on hard failure so
   * the server can emit an `error` event.
   */
  stream(
    system: string,
    user: string,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}
