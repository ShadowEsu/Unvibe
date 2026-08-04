# Night Lab report — repository-health (2026-08-04)

Mission: `repository-health`. Branch: `opencode/nightly-auto-repository-health-20260804`.

## Status

Fresh health sweep of all packages at current `main` (`bbb1dfc`). No new
defect found in `app/`, `extension/`, or `marketing/`. `web/` remains red with
the **same pre-existing breakage tracked since 2026-07-29**; the verified fix
still sits unmerged on `nightly-backend-and-sync-web-contract-alignment`.
PR creation remains blocked by the repo's Actions token policy
("GitHub Actions is not permitted to create or approve pull requests"), so
this report is the deliverable.

## Health matrix (fresh, this run)

| Package | Install | Typecheck | Test | Build |
|---------|---------|-----------|------|-------|
| `app/` | ok | **pass** | **31/31 pass** | **pass** |
| `extension/` | ok | **pass** | **34/34 pass** | n/a (parked) |
| `web/` | ok | **FAIL — 8 errors** | **31/36 pass (5 fail)** | **pass** |
| `marketing/` | ok | **pass** | **19/19 pass** | **pass** |

> Note: `app/` shows 31 tests here vs 34 in the 2026-08-04 integration-review
> summary — the difference is the three `rovingTabs` tests carried by the
> unmerged `nightly-product-design-and-accessibility-history-filter-tabs`
> branch, not a regression. Main alone is 31.

## Recent changes inspected (`git log --oneline -10`, main)

- Revert "Keep referral incentives non-cash" · founder waitlist attribution
  scorecard · frame Unvibe as vibe-code learning · homepage demo video link
  (marketing/site content — no code risk).
- Today's earlier nightly branches (ai-learning-engine comprehension fix,
  competitor research, PDA history-filter tabs, integration-review summary)
  are pushed and unmerged; a desktop-overlay bar-placement fix was lost to a
  blocked push and needs re-application.

## Pre-existing web/ breakage (unchanged, tracked since 2026-07-29)

- Typecheck: 8 errors in `test/billing.test.ts` and `test/security.test.ts`
  (`priceFor`, `proAnnualSavingsPercent`, `teamsAnnualSavingsPercent`,
  `SESSION_TTL_MS` missing; wrong `planLimit`/`MemoryStore` arity).
- Tests: 5 fail of 36 — billing pricing math, Teams seat validation, duplicate
  device-approval idempotency, expired device-code, opaque-session expiry.
- **Verified fix exists** on `nightly-backend-and-sync-web-contract-alignment`
  (checked out fresh in a worktree this run: typecheck clean, **37/37 pass**,
  build ok). Not re-fixed here to avoid a second, overlapping copy.

## Housekeeping observation (not changed)

`app/package-lock.json` declares version `0.1.1` while `app/package.json` is
`0.1.2`; `npm install` resyncs it locally. Cosmetic only — the PDA branch that
already bumps this file is unmerged, so a lock-only commit here would conflict
for no functional gain. Left to the branch-reconciliation pass.

## Files changed

- `docs/automation/nightly/2026-08-04-health-report.md` (this report)

## Tests actually run

- `app`: typecheck clean; `npm test` **31/31 pass**; `npm run build` ok.
- `extension`: typecheck clean; **34/34 pass**.
- `web`: typecheck **8 errors** (pre-existing); **31/36 pass** (5 fail,
  pre-existing); `npm run build` ok.
- `marketing`: typecheck clean; **19/19 pass**; build ok.
- Target-branch re-verification: `nightly-backend-and-sync-web-contract-alignment`
  typecheck clean, **37/37 pass**, build ok (fresh worktree).

## What was not verified

- Supabase staging (no credentials available). No manual staging verification
  was re-run this cycle.
- PR creation for the verified web fix — attempted and blocked by token policy
  (see Status).

## Risk level

None introduced (docs-only). The flagged web fix is low-risk when reviewed.

## Security and privacy impact

None from this run. The pending web fix restores idempotent device-code
redemption and server-side session expiry (security-positive).

## Performance impact

None.

## Recommended next action

Founder/operator: open a PR for `nightly-backend-and-sync-web-contract-alignment`
(verified green) and merge it to turn `web/` green on `main`; then reconcile
the backlog of overlapping web-fix and `companion.tsx` branches per the
2026-08-04 integration-review summary.
