# Model providers

Server `Provider` (`web/src/ai/provider.ts`) is the cloud interface: `stream` and `complete`. Live adapters: OpenRouter, Anthropic, Gemini, mock. `ModelProvider` is an alias. `ModelRoute` documents LOCAL / CLOUD / BYOK.

Desktop BYOK lives in `app/src/main/localAi.ts` and uses the user’s stored key.

Speech and embeddings have interfaces in `web/src/ai/speech.ts`. Cloud STT/TTS/embeddings are not configured. Desktop voice uses the OS speech recognizer only after opt-in.

Local model routing is flagged (`features.localModels`) and is not advertised as available.
