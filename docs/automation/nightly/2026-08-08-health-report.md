# Night Lab report — repository-health (2026-08-08)

Mission: `repository-health`. Branch: `opencode/nightly-repository-health-20260808`.

## Status

Fresh health sweep of all packages at current `main` (`bbb1dfc`, unchanged since
the 2026-08-05 sweep — no new commits landed on `main` in between). `app/`,
`extension/`, and `marketing/` are green. `web/` remains red with the **same
pre-existing breakage tracked every night since 2026-07-29**; the verified fix
still sits unmerged on `nightly-backend-and-sync-web-contract-alignment`
(re-verified fresh in a worktree this run: typecheck clean, **37/37 pass**).

One new low-risk defect was found and fixed this run: `app/src/core/gitDiff.ts`
attributed hunks of **deleted files** to `"/dev/null"` instead of the real path
(`git diff` emits `+++ /dev/null` for deletions). Fixed by falling back to the
`---` old path; regression test added (`parseUnifiedDiff attributes deleted-file
hunks to the old path, not /dev/null`). Also closed a small hygiene gap: `web/`
did not ignore `*.tsbuildinfo` while `marketing/` does, so every `web`
typecheck emitted a stray untracked artifact (`web/tsconfig.tsbuildinfo`);
added to `web/.gitignore`.

## Health matrix (fresh, this run)

| Package | Install | Typecheck | Test | Build |
|---------|---------|-----------|------|-------|
| `app/` | ok | **pass** | **32/32 pass** | **pass** |
| `extension/` | ok | **pass** | **34/34 pass** | n/a (parked) |
| `web/` | ok | **FAIL — 8 errors** | **31/36 pass (5 fail)** | **pass** |
| `marketing/` | ok | **pass** | **19/19 pass** | **pass** |

> `app/` test count went from 31 to 32 this run (the new regression test added
> here). No skipped or todo tests in any package.

## Recent changes inspected (`git log --oneline -10`, main)

- `Revert "Keep referral incentives non-cash"` — founder decision rolled back a
  marketing copy change.
- `Add founder waitlist attribution scorecard` — new
  `marketing/src/lib/waitlistAttribution.ts` + test, AdminWaitlist attribution
  table and "Referred signups" stat replacing "Promo claims".
- `Keep referral incentives non-cash` → `Frame Unvibe as vibe-code learning` →
  `Point homepage demo to latest official video` — marketing/site content and
  skip-link styling. No code risk; marketing tests 19/19 pass.

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

## Defect found and fixed (app/)

- **Root cause:** `parseUnifiedDiff` set `hunk.file` from the `+++` line. For
  deleted files git emits `+++ /dev/null`, so deleted-file hunks were labeled
  `/dev/null`. That label flows into the AI review context (`### /dev/null` in
  `localAi.ts:181`) and the pre-send secret scan labels (`review.ts:104`).
- **Fix:** track the `---` (old) path and fall back to it when the `+++` path is
  `/dev/null`. Verified against real `git diff` output for a deletion (now
  `a.ts`) and an unrelated modification (unchanged `b.png`).
- **Regression test:** `app/test/gitDiff.test.ts` — `parseUnifiedDiff attributes
  deleted-file hunks to the old path, not /dev/null`.

## Housekeeping fixes

- `app/package-lock.json` version synced `0.1.1` → `0.1.2` by `npm install`
  (lockfile still declared `0.1.1` while `package.json` is `0.1.2` — the
  cosmetic mismatch noted in the 2026-08-05 report). Version-only change, no
  dependency drift.
- `web/.gitignore` now ignores `*.tsbuildinfo` (matches `marketing/.gitignore`).

## Files changed

- `app/src/core/gitDiff.ts` — deleted-file path fix.
- `app/test/gitDiff.test.ts` — regression test.
- `app/package-lock.json` — version sync only.
- `web/.gitignore` — `*.tsbuildinfo` ignore.
- `docs/automation/nightly/2026-08-08-health-report.md` (this report)

## Tests actually run

- `app`: typecheck clean; `npm test` **32/32 pass** (incl. new regression test);
  `npm run build` ok.
- `extension`: typecheck clean; `npm test` **34/34 pass**.
- `web`: typecheck **8 errors** (pre-existing); `npm test` **31/36 pass**
  (5 fail, pre-existing); `npm run build` ok.
- `marketing`: typecheck clean; `npm test` **19/19 pass**; `npm run build` ok.
- Carrier re-verification: `nightly-backend-and-sync-web-contract-alignment`
  typecheck clean, **37/37 pass** (fresh worktree).

## What was not verified

- Supabase staging (no credentials available). No manual staging verification.
- macOS behavior of the app (Linux runner; see 08-05 integration summary for
  macOS-specific items). The gitDiff fix is platform-neutral parsing logic.

## Risk level

Low. The app fix is contained to diff parsing (pure function) with a regression
test; the other two changes are lockfile/ignore hygiene. The flagged web fix is
low-risk when reviewed.

## Security and privacy impact

The app fix slightly improves the privacy surface: deleted-file hunks were
labeled with a misleading `/dev/null` path during the pre-send secret scan; they
now carry the real path. No secrets are affected. No data leaves the machine
unmodified (secret filtering unchanged).

## Performance impact

None (pure parsing logic; constant-time path fallback).

## PR-creation blocker (known, unchanged)

PR creation was **blocked**: the repo setting "Allow GitHub Actions to create and
approve pull requests" is disabled, so the automation token gets a 403 on
`createPullRequest` (same blocker as the 2026-07-31/08-01/08-02 runs). The branch
`opencode/nightly-repository-health-20260808` (commit `4b43ad9`) is pushed and ready;
a founder or any user with write access can open the PR from
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-repository-health-20260808
targeting `main`.

## Recommended next action

Founder/operator: open a PR for `nightly-backend-and-sync-web-contract-alignment`
(re-verified green this run) and merge it to turn `web/` green on `main`; then
reconcile the backlog of overlapping web-fix and `companion.tsx` branches per the
latest integration-review summary. Optionally mirror the deleted-file fix into
the parked `extension/src/context/gitDiff.ts` when the extension is revived.
