# Night Lab report — repository-health (2026-08-03)

Mission: `repository-health`. Branch: `opencode/nightly-auto-repository-health-20260803`.

## Status
Health sweep across all packages. One contained defect found and fixed in `app/`
(`parseUnifiedDiff` mis-attributes deleted-file hunks to `/dev/null`), with two
regression tests added. `web/` remains red on `main` — pre-existing, unchanged,
already carried by the unmerged `nightly-backend-and-sync-web-contract-alignment`
branch. Not re-fixed here to avoid overlapping the six stale web-fix branches.

## Health matrix (fresh, this run)

| Package | Install | Typecheck | Test | Build | Lint |
|---------|---------|-----------|------|-------|------|
| `app/` | ok | **pass** | **33/33 pass** (31 + 2 new) | **pass** | n/a |
| `extension/` | ok | **pass** | **34/34 pass** | n/a (parked) | n/a |
| `web/` | ok | **FAIL — 8 errors** | **31/36 pass (5 fail)** | **pass** | n/a |
| `marketing/` | ok | **pass** | **19/19 pass** | **pass** | **clean** |

## Recent changes inspected (`git log --oneline -10`, main)
- Revert "Keep referral incentives non-cash" · founder waitlist attribution
  scorecard · frame Unvibe as vibe-code learning · homepage demo video link.
- Today's earlier nightly branches (integration-review summary, SSE spec
  compliance, widget tabs, companion focus states) are all pushed and unmerged.

## Defect found and fixed
`parseUnifiedDiff` (`app/src/core/gitDiff.ts`) set the hunk `file` from the
`+++ ` target line. For a deleted file, git emits `+++ /dev/null`, so the hunk
was attributed to `file: '/dev/null'` instead of the actual deleted path. This
degrades review scope accuracy and file labels in the diff review flow for
deleted files.

### Root cause
`+++ ` line unconditionally overwrote the captured file path even when it was
the `/dev/null` sentinel.

### Fix
Track the `--- ` old path as a fallback; only set `currentFile` from `+++ `
when it is not `/dev/null`, and from `--- ` when it is not `/dev/null`.

### Regression tests
- `app/test/gitDiff.test.ts` — deleted-file hunk attributes `file` to `old.ts`;
- `app/test/gitDiff.test.ts` — added-file hunk attributes `file` to `new.ts`
  (guards the `--- /dev/null` case from regressing the other direction).

## Files changed
- `app/src/core/gitDiff.ts`
- `app/test/gitDiff.test.ts`
- `app/package-lock.json` (version sync 0.1.1 → 0.1.2, matches `package.json`)

## Tests actually run
- `app`: `npm run typecheck` clean; `npm test` **33/33 pass**; `npm run build` ok.
- `extension`: typecheck clean; **34/34 pass**.
- `web`: typecheck **8 errors** (pre-existing); **31/36 pass** (5 fail, pre-existing); `npm run build` ok.
- `marketing`: typecheck clean; **19/19 pass**; build ok; `npm run lint` clean.

## What was not verified
- `web/` fix (needs the web-contract-alignment branch merged; requires founder
  decision to reconcile six overlapping web-fix branches).
- macOS behavior of the diff parsing change — pure string parsing, platform
  independent, low risk; **unverified on Linux runner** only in the sense of no
  real repo deleted-file scenario being exercised end-to-end.
- Supabase staging (no credentials available).

## Risk level
Low. Contained string-parsing fix with unit coverage; no API surface change.

## Security and privacy impact
None. No secrets touched; no new I/O; the change only improves file attribution
in locally-built review context.

## Performance impact
None. Linear-time string scan, unchanged complexity.

## Recommended next action
Founder/operator: open a PR from this branch (PR creation is blocked by the
repo's Actions token), and merge the web-contract-alignment branch to turn
`web/` green before it drifts further from `main`.
