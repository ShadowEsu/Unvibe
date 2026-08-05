# Night Lab report — repository-health (2026-08-05)

Mission: `auto` → `repository-health`. Branch: `opencode/nightly-auto-repository-health-20260805`.

## Status

Fresh health sweep of all packages at current `main` (`bbb1dfc`). `app/`,
`extension/`, and `marketing/` are all green. `web/` remains red with the
**same pre-existing breakage tracked every night since 2026-07-29**; the
verified fix still sits unmerged on `nightly-backend-and-sync-web-contract-alignment`
(re-verified fresh in a worktree this run: typecheck clean, **37/37 pass**).
No new defect introduced on `main` since the 2026-08-04 sweep. The
repository-health slot did not run in tonight's scheduled cycle (schedule
delivery skipped it, same as 08-04), so this run fills that gap.
Branch pushed (`opencode/nightly-auto-repository-health-20260805`); PR creation
was attempted and **failed** with the same known token-policy error
(`GitHub Actions is not permitted to create or approve pull requests`) logged
in prior nights (2026-07-24, 07-31, 08-01, 08-02) and this night's
competitor-research founder-decisions file. Create the PR manually:
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-auto-repository-health-20260805

## Health matrix (fresh, this run)

| Package | Install | Typecheck | Test | Build |
|---------|---------|-----------|------|-------|
| `app/` | ok | **pass** | **31/31 pass** | **pass** |
| `extension/` | ok | **pass** | **34/34 pass** | n/a (parked) |
| `web/` | ok | **FAIL — 8 errors** | **31/36 pass (5 fail)** | **pass** |
| `marketing/` | ok | **pass** | **19/19 pass** | **pass** |

> `app/` shows 31 tests on `main`; the three extra `rovingTabs` tests reported
> elsewhere live on the unmerged `history-filter-tabs` branch, not `main`.

## Recent changes inspected (`git log --oneline -10`, main)

- `Revert "Keep referral incentives non-cash"` — founder decision rolled back a
  marketing copy change.
- `Add founder waitlist attribution scorecard` — new
  `marketing/src/lib/waitlistAttribution.ts` + test, AdminWaitlist rendering.
- `Keep referral incentives non-cash` → `Frame Unvibe as vibe-code learning` →
  `Point homepage demo to latest official video` — marketing/site content and
  `globals.css` skip-link styling. No code risk; marketing tests 19/19 pass.

All recent `main` changes are confined to `marketing/`; none touch `app/`,
`web/`, or `extension/` source.

## Pre-existing web/ breakage (unchanged, tracked since 2026-07-29)

- Typecheck: 8 errors in `test/billing.test.ts` and `test/security.test.ts`
  (`priceFor`, `proAnnualSavingsPercent`, `teamsAnnualSavingsPercent`,
  `SESSION_TTL_MS` missing; wrong `planLimit`/`MemoryStore` arity).
- Tests: 5 fail of 36 — billing pricing math, Teams seat validation, duplicate
  device-approval idempotency, expired device-code, opaque-session expiry.
- **Verified fix exists** on `nightly-backend-and-sync-web-contract-alignment`
  (checked out fresh in a worktree this run: typecheck clean, **37/37 pass**,
  install ok). Not re-fixed here to avoid a second, overlapping copy.

## Housekeeping observations (not changed)

- A root-level `package-lock.json` (147 bytes, no deps, workspace root only)
  appeared untracked in this runner's working tree; it is a harness artifact
  from a root `npm install`, not a tracked file change. Left untracked.
- `app/package-lock.json` still declares version `0.1.1` while
  `app/package.json` is `0.1.2`. Cosmetic; the unmerged PDA branch already
  bumps it. Left to the branch-reconciliation pass.

## Files changed

- `docs/automation/nightly/2026-08-05-health-report.md` (this report)

## Tests actually run

- `app`: typecheck clean; `npm test` **31/31 pass**; `npm run build` ok.
- `extension`: typecheck clean; `npm test` **34/34 pass**.
- `web`: typecheck **8 errors** (pre-existing); `npm test` **31/36 pass**
  (5 fail, pre-existing); `npm run build` ok.
- `marketing`: typecheck clean; `npm test` **19/19 pass**; `npm run build` ok.
- Carrier re-verification: `nightly-backend-and-sync-web-contract-alignment`
  typecheck clean, **37/37 pass** (fresh worktree).

## What was not verified

- Supabase staging (no credentials available). No manual staging verification.
- macOS behavior of the app (Linux runner; see 08-05 integration summary for
  macOS-specific items).
- No new behavior added, so no unverified product surface introduced here.

## Risk level

None introduced (docs-only). The flagged web fix is low-risk when reviewed.

## Security and privacy impact

None from this run. The pending web fix restores idempotent device-code
redemption and server-side session expiry (security-positive).

## Performance impact

None.

## Recommended next action

Founder/operator: open a PR for `nightly-backend-and-sync-web-contract-alignment`
(verified green on 08-04 and re-verified green this run) and merge it to turn
`web/` green on `main`; then reconcile the backlog of overlapping web-fix and
`companion.tsx` branches per the 2026-08-05 integration-review summary.
