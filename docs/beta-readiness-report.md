# Uncode private-beta readiness report

Date: 2026-07-15

Branch: `codex/beta-core`
Verdict: **not beta-ready for external users**

Status labels in this report are: `Working and tested`, `Implemented but not fully tested`,
`Partially implemented`, `Mocked`, `Blocked`, and `Not started`.

## 1. Initial state

**Partially implemented.** The latest core branch had a working macOS Electron overlay, local
learning JSON store, a best-effort outbox, a Next.js backend with MemoryStore/SupabaseStore
abstraction, device authentication, mock AI, dashboard pages, and build/test scripts. The desktop
and parked extension baselines passed. The first web typecheck failed only because tracked/stale
generated Next metadata referenced deleted routes; a clean generated directory passed.

The audit found substantive blockers: logout did not revoke server tokens, macOS token storage
could fall back to reversible base64, real-provider endpoints were anonymous, Supabase errors were
ignored, production could silently use volatile memory, sessions never expired, remote history was
not reloaded, sync had no scheduled retry/status, UTC dates could corrupt streaks, and one correct
answer was described as mastery. Several visible companion destinations were static promises or
dead controls.

## 2. P0 blockers found

**Working and tested (audit complete).** P0s are recorded with affected files, impact, fix,
dependencies, tests, criteria, and status in `docs/product-finish-plan.md`. Credential- and
decision-dependent blockers were separated rather than guessed.

## 3. P0 blockers fixed

**Implemented but not fully tested.** The following are fixed in code and locally verified:

- current-token revocation on logout and 30-day server-side opaque-session expiry;
- secure-storage fail-closed behavior with no plaintext token fallback;
- server authentication for configured real AI providers;
- production MemoryStore fail-closed behavior and propagated Supabase errors;
- validated/bounded event and review payloads;
- atomic local JSON writes with visible persistence errors;
- identity-bound durable outbox, remote pull/merge, retry/backoff, manual retry, status, and
  auth-expired state;
- event type, local date, timezone, line/language/source metadata and additive migrations;
- cautious `Developing`/`Familiar`/`Strong`/`Needs review` evidence instead of “mastered”;
- visible beta navigation reduced to connected Home, Progress, and Settings behavior.

They are not fully complete until migrations and account/sync/RLS behavior pass against staging.

## 4. Core journey status

**Partially implemented.** Local development proves account sign-in, event push, remote history
reload, mock streaming, logout, and old-token rejection. The Electron build and core model tests
pass. The complete 27-step journey was not run in a packaged app, with a real provider, through an
offline process restart, or on a second device. “Real streamed explanation” therefore remains
blocked by a non-production provider credential and staging deployment.

## 5. Overlay status

**Implemented but not fully tested.** Selection capture, local secret scanning, SSE parsing,
cancellation, timeout, 401/429 messages, pin/collapse/close, saved bounds, inactive behavior,
keyboard-oriented controls, theme, and reduced-motion CSS exist. This run did not manually verify
Accessibility capture, editor focus retention, drag/resize ergonomics, multiple monitors, high
contrast, or specific supported applications. Compatibility claims must remain narrow.

## 6. Authentication status

**Implemented but not fully tested.** The visible desktop path is browser/device authentication or
local-only mode. Direct email auth remains a development-only backend convenience and is hidden
from the desktop beta UI. Tokens require OS secure storage, expire server-side, revoke on logout,
and all tokens are removed by account deletion. Duplicate MemoryStore device approval is
idempotent. Supabase magic-link/device approval, expiry, duplicate callbacks, and deletion have not
been run in staging. Password reset and password refresh do not apply to the selected device-code
beta path; reauthentication is required after expiry.

## 7. Backend status

**Implemented but not fully tested.** Production no longer silently falls back to MemoryStore,
Supabase operation errors are checked, API events are runtime-validated, payload sizes are bounded,
and provider-spend endpoints require auth when a real provider is configured. The MemoryStore API
journey passed. The Supabase path and additive migrations `0003`–`0005` remain unapplied/unverified
in staging. Device approval is still multiple database statements rather than one transaction.

## 8. Sync status

**Implemented but not fully tested.** Local-first writes, stable UUIDs, durable identity-bound
outbox, idempotent upsert, scheduled bounded exponential retry with jitter, remote reconciliation,
manual retry, sync status, pending count, and expired-auth state are implemented. Unit tests prove
retry bounds and merge conflict behavior; the local API smoke test proves push/reload. Offline
process-kill recovery, reconnect against Supabase, two-device reconciliation, and histories above
the current 500-record pull window are not proven.

## 9. Streak status

**Implemented but not fully tested.** New activity stores UTC timestamp, immutable user-local date,
and IANA timezone. Desktop and backend streak calculations use local dates, and the backend derives
“today” in the most recent activity timezone. Tests cover first-day/consecutive behavior, a UTC
midnight boundary, duplicate-safe events, and cautious fallback for legacy records. Real DST,
timezone-change, offline restart, and cross-device Supabase cases remain unverified.

## 10. Skills status

**Partially implemented.** Concepts are persistent within activity events and evidence labels are
derived from repeated outcomes: one pass is `Developing`, two are `Familiar`, three are `Strong`,
and latest confusion is `Needs review`. No random percentages or mastery claims remain in visible
core metrics. There is not yet a dedicated persistent skills table with review scheduling,
confidence, categories/frameworks, related explanations, or spaced-review history.

## 11. Pro subscription status

**Blocked.** No billing path was enabled, no production billing was touched, and no charge can be
made by these changes. Test-mode plan/customer/subscription/webhook/entitlement infrastructure is
not present on the latest core branch. It requires approved test product/price identifiers, Stripe
test credentials/webhook secret, and a founder pricing/entitlement decision. A frontend-only Pro
state was not added.

## 12. Dashboard status

**Partially implemented.** Home and Progress use persisted local evidence, including streak,
activity, source distribution, and cautious concept counts. Static beta promises and dead
roadmap/team/referral/help navigation were removed from the visible desktop shell. Projects,
Study, Concepts, Notebook, Briefings, Library, Profile, and Billing are not complete connected beta
surfaces and are not exposed in the visible navigation. The separate web dashboard builds but was
not visually re-verified in this run.

## 13. Privacy and security status

**Implemented but not fully tested.** Secret scanning remains local before model requests;
renderers remain sandboxed and do not own network access; no service-role/provider key is placed in
the renderer; token persistence fails closed; logout revokes; account deletion closes widgets;
RLS policies are hardened to `authenticated` ownership checks; runtime payload validation is in
place. The tracked-file scan found no committed credential; one private-key string is an intentional
secret-filter test fixture. Full context preview/per-repository consent, staging RLS isolation,
provider retention settings, and production telemetry review remain incomplete.

## 14. Accessibility status

**Partially implemented.** Semantic buttons, labels, focusable controls, status roles, reduced
motion, theme support, and keyboard-oriented interactions exist. No automated accessibility suite,
VoiceOver pass, contrast audit, scalable-text pass, or complete focus-order test was run. The
Accessibility permission flow needs a real macOS grant and editor interaction.

## 15. Performance status

**Not started.** Build output sizes were recorded by Next, but startup time, overlay-open latency,
real AI first-token latency, memory use, render counts, database query counts, and editor impact
were not measured. Sync retries are bounded and requests are timeout/cancellation aware, but this is
not a performance benchmark.

## 16. Packaging status

**Blocked.** Source build succeeds for the desktop app. Packaging was not run in this pass. The
configuration currently targets arm64 only, is unsigned and unnotarized, and depends on a local
ignored icon that is not reproducible from a clean checkout. Apple signing/notarization credentials,
an approved production HTTPS backend URL, clean/upgrade install checks, and packaged auth callback
verification are required before external distribution.

## 17. Tests run

**Working and tested.** Commands executed:

- `app`: `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`;
- `web`: clean `.next`, `npm run typecheck`, `npm test`, `npm run build`,
  `npm audit --omit=dev`;
- `extension`: `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`;
- `server`: `npm run typecheck`, `npm audit --omit=dev`;
- local backend smoke server on port 8790 with provider/Supabase keys explicitly empty;
- sign-in → event push → history reload → invalid-event rejection → mock stream → logout → old
  token rejection;
- `git diff --check` and tracked-file secret-pattern scan.

No package defines a separate lint command. No real provider, staging database, production billing,
production data, or Apple signing service was contacted.

## 18. Tests passed

**Working and tested.** Final results:

- desktop: 18/18 tests, strict typecheck, build, and production-dependency audit;
- web: 12/12 tests, strict typecheck, and Next 14.2.35 production build;
- parked extension: 34/34 tests, strict typecheck, build, and production-dependency audit;
- legacy server: strict typecheck and production-dependency audit;
- app, extension, and server audits: zero vulnerabilities;
- local API smoke: sign-in 200, event push 200, history 200, invalid event 400, mock review 200,
  logout 200, old token 401.

## 19. Tests failed

**Blocked.** `web: npm audit --omit=dev` still exits nonzero with one high and one moderate issue
in the Next.js/PostCSS chain. The earlier critical and Supabase auth advisories were removed by
upgrading Next 14.2.5 → 14.2.35 and Supabase JS 2.45.4 → 2.110.6. npm's remaining fix is Next
16.2.10, a breaking major migration that requires explicit change-control approval. The initial web
typecheck stale-`.next` failure was corrected and did not recur after a clean build.

Not run, rather than failed: staging RLS/auth/deletion, real provider streaming, offline restart,
packaged app, signing/notarization, billing, accessibility, and performance benchmarks.

## 20. Commits created

**Working and tested.** Checkpoints created:

- `fix critical beta persistence and auth blockers`
- `docs: record honest beta readiness`

Documentation/report finalization is a separate checkpoint so the implementation remains easy to
review or revert.

## 21. Commit SHAs

**Working and tested.** Implementation checkpoint: `27e4719`. Documentation checkpoint:
`9f53d1b`. This push-status update is the branch HEAD; its SHA is available from Git after the
report is written (a file cannot contain the final hash of its own commit).

## 22. Push status

**Working and tested.** The branch was successfully created and pushed to
`origin/codex/beta-core`. `main` was not pushed or modified. Existing ignored workspace directories
`app/.tools-bin/` and `web/.vercel/` were preserved and were not committed.

## 23. Remaining blockers

**Blocked.** Remaining blockers are: staging Supabase/auth/RLS/deletion proof; real-provider
credential and streaming/error validation; atomic Supabase device approval; >500-event history
pagination; full offline restart and two-device tests; dedicated skills/review model; test-mode
billing decisions and credentials; Next 16 security migration approval; complete context preview
and per-repo consent if repo context is enabled; manual accessibility/overlay/app compatibility;
reproducible icon and signed/notarized package.

## 24. Founder decisions required

**Blocked.** Required decisions/inputs:

- authorize a disposable staging Supabase project and non-production AI credential;
- approve or reject the breaking Next 16 migration;
- define test-mode Pro entitlements and pricing identifiers, then provide Stripe test credentials;
- decide whether histories above 500 records must ship in this beta;
- confirm arm64-only beta support or add Intel verification;
- provide Apple signing/notarization credentials and the approved production backend URL;
- obtain attorney approval for Terms, Privacy Policy, retention, deletion, and subscription copy.

## 25. Honest beta-readiness verdict

**Blocked.** The repository is materially safer and more reliable than its initial state, and the
local development core is working and tested. It is **not honest to label it beta-ready for real
external users yet**. The largest remaining gap is evidence: persistent staging services, a real
provider, real offline/restart behavior, two-user isolation, and a distributable signed app have not
been verified. Billing is safely absent, not complete. Legal drafts remain drafts. External beta
invites should wait until the blocked checks above are completed and this report is updated with
their evidence.
