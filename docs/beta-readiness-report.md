# Unvibe private-beta readiness report

Date: 2026-07-15

Branch: `codex/beta-core`

Verdict: **locally prepared; blocked for external beta pending credential/owner gates**

## Executive status

The credential-free engineering pass is green. `npm run verify:beta` completed 22/22 checks on macOS arm64 and wrote machine/human reports to `.release/verify-beta.json` and `.release/verify-beta.md`. It did not contact production, a paid AI provider, billing, Apple signing/notarization, or a remote staging service.

This is not a release declaration. Staging migrations/RLS/deletion, real-provider inference, two-device/offline packaged behavior, clean-machine QA, signing/notarization, runtime accessibility/performance, legal approval, branding/contact decisions, and dependency-major decisions remain blockers.

## Work completed

### Authentication and persistence

- Additive migration `0006_atomic_device_flow.sql` moves approval/user/session/device updates into one locked database transaction.
- Approval is idempotent for the same user before redemption. Expired, cross-user, and already-redeemed approvals fail.
- Redemption is one-time and returns distinct pending/expired/used/unknown states. MemoryStore tests cover duplicate approval, expiry, replay, and post-redemption approval.
- Database functions use `SECURITY INVOKER`; execute is revoked from public/anon/authenticated and explicitly granted to `service_role`.

Status: **implemented and locally tested; migration unapplied/unverified in staging**.

### Sync and history

- History uses opaque cursor pagination with deterministic `(ts DESC, id DESC)` ordering and a service-only SQL page function.
- Desktop pulls pages sequentially in batches of 200, folds duplicate IDs, rejects repeated cursors, reports progress, and supports cancellation on shutdown.
- A test restores 1,203 records, including equal timestamps, with no gaps/duplicates. Local API smoke verifies write → paged restore → account deletion → old-token rejection.

Status: **implemented and locally tested; two-device/offline Supabase behavior remains unverified**.

### Skills model

- Additive migration `0007_skills_and_history_pagination.sql` adds stable per-user/normalized-concept skills with display name, category/language/framework slots, first/last/review dates, encounter/review/correct/incorrect counts, cautious evidence state, next-review date, related projects, and related event IDs.
- Event upsert rebuilds skills; unique `(user_id, normalized_name)` preserves database identity. RLS permits authenticated self-read only; backend owns writes.
- One success is only `seen`, two are `familiar`, three are `strong`, and a latest `needs_review` overrides success count. No mastery claim is made.

Status: **prepared and unit-tested; deliberately not exposed as a finished surface until staging migration/RLS proof**.

### Staging, RLS, and deletion tooling

- Root `.env.staging.example` and guarded staging scripts require `APP_ENV=staging`, explicit confirmation, HTTPS, Supabase host/project allowlist, distinct production refs/origins, and a separate destructive-test switch.
- `npm run verify:staging` checks reachability/migrations and, when authorized, runs disposable two-user RLS and account-deletion suites.
- The RLS suite validates own reads, cross-user zero rows, denied direct writes, and denied server-only token/device access. Projects are derived; notes/saved explanations/subscriptions are honestly reported absent.
- The deletion suite seeds user/session/event/consent/skill rows, calls the real endpoint, requires zero primary rows, and rejects token replay.

Status: **executable but not run; no staging credentials/resources were available**.

### Packaging

- Packaging assets (`icon.icns`, icon/tray PNGs, entitlements) are tracked from clean checkout.
- `npm run package:local` refuses production, HTTP, localhost, missing staging URL, and missing icon; it embeds the approved HTTPS backend, creates an arm64 unsigned DMG, and writes SHA-256.
- `npm run verify:package` verified checksum, `.app`, `com.unvibe.app`, and absence of an embedded localhost URL.
- Local artifact: `Unvibe-0.1.0-arm64-unsigned.dmg` (ignored build output). It is for internal QA only.

Status: **unsigned package generated and structurally verified; clean-machine QA/signing/notarization blocked**.

### Marketing, privacy, and legal preparation

- Marketing moved from Next 14.2.5 to 14.2.35 and builds/tests.
- Free wording now means “no charge during the current private beta; no credit card,” not permanently/unlimited free.
- Unverified “provider never trains,” exact payload preview, per-repository consent, immediate universal deletion, encrypted-backup, and at-rest claims were narrowed to current engineering truth and explicit pre-launch gaps.
- Engineering data-flow, inventory, retention, deletion, provider-disclosure, legal-review, support, rollback, onboarding, feedback, release notes, QA, signing, and founder decision docs were added. They are drafts, not legal approval.

Status: **prepared for counsel/operator review; no legal approval claimed**.

## Verification evidence

The final one-command run passed:

- Desktop: strict typecheck, 19/19 tests, build.
- Web/backend: strict typecheck, 17/17 tests, Next production build.
- Parked extension: strict typecheck, 34/34 tests, build.
- Legacy server: strict typecheck.
- Marketing: strict typecheck, 3/3 tests, Next production build.
- Repository safety: secret-pattern scan, documentation links, no `SECURITY DEFINER`, packaging icon, `git diff --check`.
- Dependency gate: no critical or unrecognized advisory; only exact acknowledged IDs accepted.
- API smoke: sign-in, event write, paged restore, delete, token invalidation.
- Packaging smoke: fresh unsigned DMG/checksum/bundle/backend inspection.

## Dependency blockers

Current npm data reports acknowledged advisories in Next.js 14, Electron 36/electron-builder 25, their build chain, and the parked extension's old esbuild. npm's supported fixes require Next 16, Electron 43, electron-builder 26, and an esbuild 0.x breaking-minor upgrade. Those are not silently applied because repository change control requires sign-off for major/architecture changes.

The audit gate records exact advisory source IDs and fails on any new or critical item. Plans are in `docs/release/next16-upgrade-plan.md` and `docs/release/electron-upgrade-plan.md`. Exact allowlisting is risk visibility, not a vulnerability fix.

## Remaining release blockers

1. Provision isolated Supabase/Vercel staging; apply migrations 0001–0007; run full staging verifier with destructive suites.
2. Run real-provider checklist with restricted staging key, spend cap, synthetic code, retention/terms review, and failure/secret-filter evidence.
3. Complete offline/restart and two-device tests against staging, including >500 restore and account switching/deletion.
4. Perform clean-machine packaged QA, supported-macOS/Accessibility/VoiceOver/multi-display/performance matrices.
5. Finalize product name, bundle ID, minimum macOS/architecture, support/legal contacts, cohort, backend domain, provider/model, and no-charge/fair-use policy.
6. Obtain counsel approval for published Terms/Privacy/retention/deletion/provider statements.
7. Decide whether to pause for Next/Electron/build dependency upgrades; execute approved migration plans.
8. Sign, notarize, staple, Gatekeeper-assess, checksum, and retest the approved artifact.

Billing remains disabled. No production billing, real charge, production data mutation, main-branch push, force-push, secret exposure, or legal approval occurred.

## Honest verdict

The branch is materially closer to a stable beta and all safe local preparation is complete. It is **not ready for real external distribution** until the owner/credential-dependent blockers above have passing evidence. The release index is `docs/release/README.md`; the go/no-go artifact is `docs/release/release-checklist.md`.
