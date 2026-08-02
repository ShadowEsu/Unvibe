# Night Lab report — backend-and-sync (2026-08-02)

Mission: `backend-and-sync`. Branch: `opencode/nightly-backend-and-sync-web-contract-alignment`
(commit `f77177a`).

## Status

Code change complete and pushed. PR creation **blocked**: the repo setting "Allow GitHub
Actions to create and approve pull requests" is disabled, so the automation token receives
403 on `createPullRequest` (same blocker as the 2026-07-31 and 2026-08-01 runs; token can
create issues but not PRs). The branch is ready; a founder (or any user with write access)
can open the PR from
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-backend-and-sync-web-contract-alignment
targeting `main`.

## Problem discovered

The **web package test suite and typecheck were red on `main`**:

- `npm test` (web): 31 pass / **5 fail** — pricing math, Teams seat validation, duplicate
  device approval idempotency, expired device-code rejection, opaque-session expiry.
- `npm run typecheck` (web): **8 errors** — tests referenced `priceFor`,
  `proAnnualSavingsPercent`, `teamsAnnualSavingsPercent`, `SESSION_TTL_MS`, and a
  `MemoryStore(now)` constructor that no longer existed.

Root cause: `MemoryStore` (and `plans.ts`) were refactored without honoring the existing
`Store` interface (`web/src/data/types.ts`) and the Supabase auth contract
(migrations 0002 device TTL, 0004 session TTL, 0006 atomic device flow). `MemoryStore` no
longer implemented the `'expired' | 'used'` redeem states, never expired sessions, and
approval minted a new token on every call. Several earlier orphaned nightly branches
(`opencode/nightly-auto-test-fixes-and-audit`, `opencode/nightly-repository-health-web-fixes`,
`opencode/nightly-backend-and-sync-keyset-sync`) fixed fragments of this but none were merged.

## Changes (low risk, additive)

- `web/src/data/memoryStore.ts` — restored the auth contract: 10-minute device-code TTL,
  one-time redemption (`pending`/`expired`/`used`), idempotent approval returning the existing
  token, 30-day opaque-session TTL, injectable clock, legacy plain-string token migration.
  Matches `approve_device_code`/`redeem_device_code` semantics in migration 0006.
- `web/src/billing/plans.ts` — restored `priceFor`, `proAnnualSavingsPercent`,
  `teamsAnnualSavingsPercent` (published Pro $8/mo, $72/yr, 25% annual savings, verified
  against `docs/billing.md` and `docs/billing-implementation-report.md`); `normalizedSeats`
  now rejects non-integer or <2 seat counts instead of silently clamping.
- `web/test/billing.test.ts` — pass the `seats` argument to `planLimit`.
- `web/test/security.test.ts` — added a regression test that real-clock sessions are valid
  immediately (the default-clock constructor regression).
- `docs/staging-test-plan.md` — added device-code lifecycle and session-expiry verification
  steps for the manual staging pass.

## Files changed

- `web/src/data/memoryStore.ts`
- `web/src/billing/plans.ts`
- `web/test/billing.test.ts`
- `web/test/security.test.ts`
- `docs/staging-test-plan.md`

## Tests actually run (exact)

- `web` `npm run typecheck`: clean (was 8 errors).
- `web` `npm test`: **37/37 pass** (was 31/36; +1 new regression test).
- `web` `npm run build`: succeeds.
- `app` `npm run typecheck`: clean.
- `app` `npm test`: **31/31 pass**.
- `app` `npm run build`: succeeds.

## What was not verified

- Real Supabase staging (no credentials available): RLS, device-flow RPCs, remote sync,
  revocation, and remote deletion **not executed**. `SupabaseStore` remains unverified;
  `MemoryStore` now mirrors its documented contract.
- macOS behavior: unverified on Linux runner.
- Real Stripe checkout: not run.

## Security and privacy impact

- Positive: session and device-code expiry enforced in the dev store, matching production
  migrations. Secrets stay main-process-only (verified: no `SUPABASE_*`/provider keys reach
  `app/src/renderer` or preload; renderer has no network access).
- No credentials, `.env` files, or API keys committed. No `.github/workflows/` changes.

## Founders — decisions required

1. **Enable PR creation for automation** (repo setting), or open the PR manually from the
   branch URL above (target `main`). Do not auto-merge.
2. **Stale nightly branches**: six+ earlier `nightly-*` branches remain unmerged with no open
   PRs (backend-and-sync keyset-sync, repository-health-web-fixes, auto-test-fixes-and-audit,
   repository-health-2026-07-26, auto-repository-health-20260731). Several fix the same red
   web suite with different scopes; this branch supersedes them for the auth/session contract
   and pricing exports, but `keyset-sync` additionally carries keyset history pagination.
   Integrate deliberately, not by blind merge.
3. **Pre-existing web test/typecheck failures are now resolved** on this branch; nothing else
   from the 2026-08-01 summary remains open in the web suite.
