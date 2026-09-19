/** Speech providers stay interchangeable. Do not bind Unvibe to one vendor. */

export interface SpeechToTextProvider {
  readonly name: string;
  transcribe(audio: ArrayBuffer, mimeType: string, signal?: AbortSignal): Promise<string>;
}

export interface TextToSpeechProvider {
  readonly name: string;
  speak(text: string, signal?: AbortSignal): Promise<ArrayBuffer>;
}

export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

/** Desktop opt-in capture uses the OS speech recognizer. Cloud STT is not wired. */
export class UnsupportedSpeechToText implements SpeechToTextProvider {
  readonly name = 'unsupported';
  transcribe(): Promise<string> {
    return Promise.reject(new Error('No cloud speech provider is configured.'));
  }
}
