# Product data flow — engineering draft

This is factual input for counsel, not a privacy-policy approval.

1. A user explicitly invokes Unvibe while VS Code or Cursor is active. The macOS app uses the Accessibility permission path to obtain selected text; it does not record the screen or keystrokes.
2. The Electron main process creates limited review context. Local exclusions and secret-pattern checks run before a remote request. Renderer processes do not own network access.
3. If a secret finding blocks the request, code stays local. If allowed and cloud analysis is enabled, filtered context, review scope, level, and project-summary metadata go by HTTPS to the Unvibe Next.js backend.
4. The backend authenticates configured real-provider requests and streams filtered prompt context to the configured AI provider. The backend returns an SSE explanation/quiz response. The current code does not intentionally store raw reviewed source in learning tables.
5. The desktop stores learning-event metadata locally in `unvibe-store.json`: event ID/time, scope/level/outcome, optional file/project/concept labels, line count, language, and source app. The session token is encrypted with Electron `safeStorage`; persistence fails closed without it.
6. When signed in, the main process uploads event metadata through the backend. Supabase stores users, events, derived skills, sessions, device codes, and consent log. The backend uses a service-role key; direct authenticated reads are restricted by RLS.
7. Account deletion calls the authenticated backend endpoint, deletes primary custom user data/session rows, then the desktop wipes its local learning store after success. Infrastructure backup/log behavior is not established in this repository.

Open questions: exact provider/model and contractual retention; hosting regions; backup/restore deletion propagation; telemetry vendor/config; support tooling; legal basis/age/jurisdiction; context preview/per-repository consent completeness.
