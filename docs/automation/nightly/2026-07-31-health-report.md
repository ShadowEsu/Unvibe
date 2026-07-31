# Nightly repository health report — 2026-07-31

Mission: `auto` (repository-health). Branch: `opencode/nightly-auto-repository-health-20260731`.

## Outcome

Found and fixed a genuine defect on `main`: the `web/` package did **not** typecheck and 5 tests
failed. Root cause: stale tests targeting billing/session APIs that were deliberately removed from
source by the human-authored refactor commits `6e21fee` and `eddac36` ("Restore web auth and billing
build compatibility"). Two previous nightly branches touched the same files but were never merged.

A secondary dev/prod divergence was fixed in the dev-only `MemoryStore`: `approveDeviceCode` now
mirrors the production `approve_device_code` RPC (idempotent approval, one-time redemption), so dev
behavior matches the Supabase migration contract instead of minting a new token on re-approval.

## What passed (unchanged)

- app: typecheck, build, 31/31 tests
- extension: typecheck, 34/34 tests
- server: typecheck
- marketing: typecheck, build (no warnings), 18/18 tests
- web: build (no warnings)

## What was broken and fixed

| Check | Before | After |
| --- | --- | --- |
| web typecheck | 8 errors (removed `priceFor`, `proAnnualSavingsPercent`, `teamsAnnualSavingsPercent`, `SESSION_TTL_MS`; wrong `planLimit` arity) | clean |
| web tests | 5 fail / 36 | 0 fail / 35 |

## Root cause

`test/billing.test.ts` and `test/security.test.ts` were written against a pre-refactor API:

- `priceFor` / annual-savings helpers were removed when billing moved to Stripe price IDs and
  `planLimit` gained a `seats` argument (`eddac36`).
- `normalizedSeats` now clamps into a valid range instead of throwing (matches migration
  `20260716092442_plans_workspaces_billing.sql` check `plan <> 'teams' or seats >= 2`).
- `MemoryStore` lost clock injection and `SESSION_TTL_MS`; expiry is enforced by the Supabase schema
  (migrations `0002_device_code_lifecycle.sql`, `0004_session_expiry.sql`) and staging scripts.

## Changes

- `web/test/billing.test.ts`: drop removed pricing imports; assert beta quotas via `limitFor` /
  `quotaMessage`; assert clamping behavior of `normalizedSeats`; pass `seats` to `planLimit`.
- `web/test/security.test.ts`: remove `SESSION_TTL_MS` import; replace clock-injected expiry tests
  with a documented note that expiry is prod-schema-enforced and staging-verified.
- `web/src/data/memoryStore.ts`: idempotent device approval + one-time redemption (`'used'` state),
  matching migration `0006_atomic_device_flow.sql`; low-risk dev-only change.
- `app/package-lock.json`: synced lockfile version 0.1.1 → 0.1.2 (drift with `package.json`).

## Regression coverage added

- `security.test.ts` "duplicate device approval is idempotent and does not mint another token" now
  exercises the fixed `MemoryStore` approval/redemption lifecycle.
- `billing.test.ts` "beta quotas cap the two metered actions at published totals" locks in the
  current quota constants.

## Not verified

- Expiry behavior in production (requires Supabase credentials; covered by staging scripts).
- macOS behavior (unverified on Linux runner — not relevant to these files).

## Required founder decisions

- Two earlier nightly branches (`nightly-repository-health-web-fixes`, `nightly-auto-test-fixes-and-audit`)
  took the opposite direction (re-adding removed exports to source). They were never merged. This PR
  aligns tests to the current source instead. If the pricing helpers are wanted back, that is a
  product decision, not a test fix.
