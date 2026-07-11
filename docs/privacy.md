# Privacy & context-handling policy (MVP)

Uncode may process private repos, credentials, proprietary source, student projects, and
sensitive config. Core principle: **the user sees exactly what will be transmitted before any
cloud analysis, and secrets are filtered locally before they can leave the machine.**

## Local vs remote boundary
- **Local (always):** file reading, diff parsing, context construction, secret filtering,
  exclusion checks. Nothing leaves without passing these.
- **Remote (consent-gated):** the filtered explanation request to the model provider.

## Default exclusions (never sent)
- Secrets/config: `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa*`, `*.p12`, `*.keystore`,
  `credentials`, `*.secret`.
- Dependency/build/output: `node_modules/`, `dist/`, `build/`, `out/`, `.next/`, `target/`,
  `vendor/`, `.venv/`, `__pycache__/`.
- Binaries & large generated: images, archives, media, `*.min.*`, lockfiles over a size cap,
  files above a byte threshold.
- Also honored: `.gitignore` and product-specific **`.unvibeignore`**.

## Secret scanning (pre-send, blocking)
Before any remote request the exact payload is scanned with: known-provider patterns
(AWS keys, Google API keys, Slack/GitHub tokens, JWTs, private-key headers), high-entropy
string detection, and `KEY=`/`SECRET=`/`TOKEN=` assignment heuristics. A hit **blocks** the
request and shows the file + line; the user may redact or add to `.unvibeignore`.

## Context limits
Hard cap on characters/tokens sent per request; oversized context is truncated with a visible
notice. Only the constructed context (selection + enclosing scope + imports + diff + shallow
structure) is sent — never the whole repo.

## Storage & retention
- **Transmitted:** filtered context for the duration of the request.
- **Stored (backend):** metadata + structured explanation payloads + citations + mastery.
  **Source code is not stored** beyond what a citation quotes (short snippets, filtered).
- **Deletion:** delete account (cascades) and per-repository disconnect (removes repo data).

## Consent & permissions
- Cloud analysis is **off until the user grants per-repo consent**, after viewing the
  transmission preview. Consent + revocations recorded in `consent_log`.

## Logging & telemetry
- Metadata-only logs (event type, latency, token counts). **Never** log code or secrets.
- Telemetry is **opt-in**.

## Model-provider settings
- Use a provider/config that does **not train on submitted data** (Anthropic API does not
  train on API inputs by default). Documented and asserted in code config.

## Encryption
- TLS in transit; AES-256 at rest (Supabase).

## Incident-response expectation (MVP-level)
On suspected secret leak: revoke affected tokens guidance to user, purge stored request
artifacts, document scope. Full IR runbook is post-MVP.

## Test coverage (see test strategy)
`.env` exclusion · token detection (true/false positives) · ignored directories · telemetry
disabled by default · delete-account flow · repository disconnect · transmission-preview
matches what is actually sent.
