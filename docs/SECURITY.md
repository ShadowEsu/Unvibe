# Security (implemented)

- Desktop renderers have no Node and no network. Main process owns I/O.
- Secret filter runs before cloud or BYOK model calls.
- Session tokens use Electron `safeStorage` / OS keychain. Unencrypted tokens are discarded.
- Cloud `/api/v1/reviews` requires a session or sealed trial when a real provider is configured. Mock stays available for local development.
- Review context is rejected above 120,000 characters, and follow-up questions above 4,000 (413).
- Sealed-trial AI requests are capped per install, per IP per day, and globally per month and per day; a counter outage refuses the request (503). See `docs/DEPLOYMENT.md`.
- Provider API keys stay in server env or the desktop keychain (BYOK). They are not in renderer bundles.
- Desktop product events never include source, prompts, or keys.
- Knowledge objects default to PRIVATE. Human-verified notes are not overwritten by later AI output.
- GitHub App install is not shipped. Do not grant org-wide tokens.
- No SOC 2, HIPAA, or zero-retention claim is made.
