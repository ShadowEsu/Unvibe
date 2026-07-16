# Privacy and context handling — engineering status

This file describes implemented behavior and remaining work. It is not the public Privacy Policy.
Legal drafts in `docs/legal/` still require attorney and founder approval.

## Implemented now

- The Electron main process owns network requests; sandboxed renderers have no Node or network
  access.
- The desktop sends the selected snippet only after the local secret scanner runs. Known keys,
  tokens, private-key headers, and dangerous secret assignments hard-block transmission. Suspect
  high-entropy values require an explicit confirmation.
- Raw selected code is used for the model request but is not included in the learning event sent
  to the persistence API. Synced learning records contain metadata such as timestamp, local date,
  timezone, level, line count, language, source app, outcome, project, and concept.
- Billing analytics are restricted to enumerated lifecycle events, plan/interval identifiers,
  seat counts, and aggregate usage. Source code, repository contents, prompts, explanations, and
  invitation tokens are not written to analytics or billing audit metadata.
- Real-provider endpoints require a valid server-side bearer session. The mock provider remains
  available without an account for local development.
- Desktop account tokens are persisted only through Electron `safeStorage`. If OS-backed
  encryption is unavailable, account mode fails closed and local-only use remains available.
- Sign-out revokes the current server token. Opaque sessions expire after 30 days. Account
  deletion removes server records and sessions, then clears local learning and closes widgets.
- `.env`, private keys, build output, dependencies, and common credential files are excluded from
  version control. The committed secret-filter tests contain fake key patterns only.

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
- No production telemetry or incident-response pipeline was configured or tested.

## Required before inviting external beta users

Run the staging RLS/deletion matrix, verify provider data-use settings, add the complete context
preview and consent record if repository context is enabled, and have the public Terms and Privacy
Policy approved. Do not describe the product as local-only: filtered selected code is transmitted
to the configured backend/model provider for cloud explanations.
