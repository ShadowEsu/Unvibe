# Privacy and context handling — engineering status

This file describes implemented behavior and remaining work. It is not the public Privacy Policy.
Legal drafts in `docs/legal/` still require attorney and founder approval.

## Implemented now

- The Electron main process owns network requests; sandboxed renderers have no Node or network
  access.
- The desktop sends the selected snippet, a follow-up question, or a Chat message only after the
  local secret scanner (`app/src/core/secretFilter.ts`) runs. Known keys, tokens, private-key
  headers, database URLs with passwords, and password-style assignments hard-block transmission.
  Suspect high-entropy values in an explanation request require an explicit confirmation; Chat
  and lesson questions have no confirmation step, so any finding stops the message.
- Raw selected code is used for the model request but is not included in the learning event sent
  to the persistence API. Synced learning records contain metadata such as timestamp, local date,
  timezone, level, line count, language, source app, outcome, project, and concept.
- Billing analytics are restricted to enumerated lifecycle events, plan/interval identifiers,
  seat counts, and aggregate usage. Source code, repository contents, prompts, explanations, and
  invitation tokens are not written to analytics or billing audit metadata.
- Real-provider endpoints require a valid server-side bearer session. The mock provider remains
  available without an account for local development. `/api/v1/reviews` now matches comprehension:
  session or sealed trial when a cloud provider is configured, plus a 120,000 character context cap.
- Desktop account tokens are persisted only through Electron `safeStorage`. If OS-backed
  encryption is unavailable, account mode fails closed and local-only use remains available.
- Sign-out revokes the current server token. Opaque sessions expire after 30 days. Account
  deletion removes server records and sessions, then clears local learning and closes widgets.
- `.env`, private keys, build output, dependencies, and common credential files are excluded from
  version control. The committed secret-filter tests contain fake key patterns only.
- Feedback (`marketing/src/app/feedback/route.ts`) stores the rating, the message (control
  characters stripped), the source, an optional email, page and app version, and `ip_hash`: the
  first 32 hex characters of a SHA-256 over `FEEDBACK_IP_SALT` (or the public default
  `unvibe-feedback` when it is unset) and the client IP. With the default salt, the hash of an IPv4
  address can be reversed by trying every address. No code reads `ip_hash` back: the rate limit
  (5 sends per 10 minutes) keys an in-memory map in each server instance on the same hash. The
  `feedback_submitted` PostHog event carries only the rating and source, under a random UUID per
  send. `site_feedback` has no migration in this repo, so whether `ip_hash` may be null is
  unverified, and the route still writes it.

## Not implemented or not verified

- Full per-repository consent and a preview of the exact complete payload are not implemented in
  the desktop selection flow. The current consent screen appears only when the secret scan finds a
  suspect value.
- The desktop does not index repositories in the background and currently has no repository
  disconnect UI because repository indexing is not a beta feature.
- Supabase RLS, deletion cascades, managed encryption, and User A/User B isolation have been
  reviewed in migrations but not proven against a staging project in this run.
- Provider retention and model-training promises depend on the selected provider contract and
  deployment settings; they must be verified before public legal copy makes those claims.
- The desktop app has no analytics SDK. Its build has no PostHog, Mixpanel or other analytics
  client, and `productEvent` (`app/src/core/productEvents.ts`) does nothing. What it does send
  about setup is listed below (anonymous setup progress, on by default, with a switch to turn it
  off). The
  website's Mixpanel and PostHog tracking is described on unvibe.site/privacy. Incident-response
  alerting is still not configured.
- Without an account, each cloud explanation and the launch usage check carry a random install ID
  (`app/src/main/backend.ts` `aiAuthHeaders`), the OS family (`mac`/`win`) and the app version.
  The server stores, per hashed install ID: when the app first started, its OS family and starting
  version (set once), explanation counts, and the first time it explained the setup sample, its
  own code, and again on a later day in its first week (`return`). Signed in, the app sends only
  the session token.
- Sealed trial builds also send write-once setup progress to `POST /api/v1/trial/progress`
  (`app/src/main/progress.ts`): setup finished, Accessibility asked and allowed (Mac), signed in
  (UTC day only), level question answered, and the launch-at-login question shown and accepted
  (`app/src/main/main.ts`, `askLaunchAtLogin`). One timestamp per step, no code, file names, email
  or IP. Settings, Privacy & Data, "Send anonymous setup progress" turns these off; it does not
  cover the rows above, which come from requests the app makes anyway. Both are described on
  unvibe.site/privacy and in `app/PRIVACY.md`.

## Required before inviting external beta users

Run the staging RLS/deletion matrix, verify provider data-use settings, add the complete context
preview and consent record if repository context is enabled, and have the public Terms and Privacy
Policy approved. Do not describe the product as local-only: filtered selected code is transmitted
to the configured backend/model provider for cloud explanations.
