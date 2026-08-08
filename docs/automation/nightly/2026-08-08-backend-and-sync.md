# Night Lab report — backend-and-sync (2026-08-08)

Mission: `backend-and-sync`. Branch: `opencode/nightly-backend-and-sync-event-batch-wedge`
(commit `c68b47a`), pushed to `origin`.

## Status

Code change complete, typecheck/test/build verified, and pushed. **PR creation blocked**:
the repo setting "Allow GitHub Actions to create and approve pull requests" is disabled, so
`gh pr create` returns `createPullRequest: GitHub Actions is not permitted to create or
approve pull requests` (same blocker as every nightly run since 2026-07-24). A founder or
any user with write access can open the PR from
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-backend-and-sync-event-batch-wedge
targeting `main`.

## Problem discovered

**Client/server batch-size contract mismatch can wedge sync permanently.** The desktop app's
`pushEvents` (`app/src/main/backend.ts`) sends the entire pending outbox in a single POST to
`/api/v1/events`, but the backend rejects any batch over 500 events
(`web/app/api/v1/events/route.ts` — `events must contain at most 500 valid activity
records`, HTTP 400). A user who accumulates more than 500 offline events would get a
permanent 400, which `sync.ts` classifies as a generic `'error'` retry — so sync retries
forever with exponential backoff and never succeeds. No existing branch touches this path
(checked `web-contract-alignment`, `keyset-sync`, `auto-backend-and-sync-20260804`,
`backend-and-sync-20260724`, `audit-staging-docs`).

## Changes (low risk, additive)

- `app/src/core/syncModel.ts` — new pure `batchEvents<T>()` helper + exported
  `EVENT_PUSH_BATCH_SIZE = 400` (conservative: under the server's 500 cap to leave room for
  large lesson bodies and proxy body-size limits; pure/unit-testable without electron).
- `app/src/main/backend.ts` — `pushEvents` now POSTs batches sequentially, collecting
  accepted ids for outbox clearing. Partial failures keep already-accepted ids synced and
  leave the remainder queued for the next sync attempt.
- `app/test/syncModel.test.ts` — two regression tests.

## Results

| Check | Result |
|---|---|
| `app npm run typecheck` | 0 errors |
| `app npm test` | **33/33 pass** (was 31/31; +2 new) |
| `app npm run build` | ok |

New tests: `event batches never exceed the backend per-request cap`,
`a single small batch is returned untouched`.

## What was not verified

- Live end-to-end sync against a real backend (no credentials on this runner; static
  inspection only per mission).
- macOS behavior: main-process networking change only, no UI; still
  "unverified on Linux runner".
- `web/` on `main` remains red (pre-existing 8 typecheck errors / 5 failing tests — fix
  verified on the unmerged `session-ttl-parity` branch, unchanged this run).

## Security and privacy

No new secrets; no renderer code touched; preload bridge verified clean (no SUPABASE or
service-role key reaches `app/src/preload/` or `app/src/renderer/`). Payload splitting does
not change content — same events, same auth, same outbox-clearing contract.

## Required founder decision

**Unblock night-lab PR creation** (persistent since 2026-07-24): enable "Allow GitHub
Actions to create and approve pull requests" for this repo. Branch is pushed and ready; it
can only be merged by hand until then.

## Manual review steps

1. Review `batchEvents` bounds in `app/src/core/syncModel.ts`.
2. Confirm partial-failure semantics in `pushEvents` match the outbox-clearing contract in
   `sync.ts` (`markSynced(accepted)` clears only returned ids).
3. `cd app && npm test` → 33/33; `npm run typecheck` → clean.
