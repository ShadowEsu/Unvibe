# Night Lab report — backend-and-sync (2026-08-07, session-TTL parity)

Mission: `backend-and-sync`. Branch: `opencode/nightly-backend-and-sync-session-ttl-parity`,
built on top of `opencode/nightly-backend-and-sync-stale-tests-20260807` (same night, unmerged).

## Status

Change complete, typecheck/test/build verified, pushed. **PR creation blocked by repo
settings** — "Allow GitHub Actions to create and approve pull requests" is disabled, so the
automation token gets `createPullRequest` 403 (verified again this run). A founder or any
user with write access can open the PR from
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-backend-and-sync-session-ttl-parity
targeting `main`. Merging this branch also subsumes the unmerged
`stale-tests-20260807` branch (it is its direct ancestor).

## Why this was selected

A prior run tonight fixed the stale web tests that kept `web` red on `main` (31 pass / 5
fail, 8 typecheck errors) and explicitly recommended **session-expiry parity** as the
contained follow-up: prod migrations add a 30-day `tokens.expires_at`
(`0004_session_expiry.sql`) but the dev `MemoryStore` never enforced any session TTL, and
the production `SupabaseStore.userForToken` never filtered on it either.

## Evidence

- `web npm run typecheck` on `main` (HEAD `bbb1dfc`): 8 errors (stale test imports).
- `web npm test` on `main`: 31 pass / 5 fail.
- Prod migration `0004_session_expiry.sql`: `tokens.expires_at` default `now() + interval '30 days'`.
- `SupabaseStore.userForToken` queried tokens without an expiry filter; `MemoryStore` had no expiry at all.
- Staging-guarded verification already exists (`web/scripts/staging-guard.ts`,
  `npm run verify:staging`, `docs/staging-test-plan.md`) — the new prod query filter is
  covered by that manual release gate.

## Root cause

`0004_session_expiry.sql` added the column and the migration comment claims "Opaque sessions
expire server-side", but no code path rejected an expired token: `MemoryStore.userForToken`
returned the raw map value and `SupabaseStore.userForToken` never compared `expires_at`.
The behavior was documented but not enforced.

## Changes (low risk, additive — dev store + one query filter)

- `web/src/data/memoryStore.ts` — mirror prod 30-day opaque-session expiry:
  `SESSION_TTL_MS` (30 days), token records now carry `createdAt`, `userForToken` returns
  null once a token is older than the TTL, and a legacy-shape migration upgrades any
  hot-reloaded `token -> userId` string map so the dev store keeps working after reloads.
- `web/src/data/supabaseStore.ts` — `userForToken` adds `.gte('expires_at', now)` so expired
  tokens are rejected in production too (the enforcement `0004` intended).
- `web/test/security.test.ts` — restored the removed "opaque sessions expire server-side"
  regression test using the injectable clock.

## Files changed

- `web/src/data/memoryStore.ts`
- `web/src/data/supabaseStore.ts`
- `web/test/security.test.ts`
- `docs/automation/nightly/2026-08-07-backend-and-sync-session-ttl.md` (this report)

## Tests actually run

- `web npm run typecheck` — passed, 0 errors.
- `web npm test` — 35 tests, **35 pass / 0 fail** (includes new session-expiry regression).
- `web npm run build` (`next build`) — succeeds.
- `app npm run typecheck` — passed, 0 errors (app untouched, sanity check).
- `app npm test` — 31 pass / 0 fail.

## Exact results

| Check | Before | After |
|---|---|---|
| `web npm run typecheck` | 8 errors | 0 errors |
| `web npm test` | 31 pass / 5 fail | 35 pass / 0 fail |
| `web npm run build` | red (tests failed) | succeeds |
| `app npm run typecheck` / `npm test` | — | 0 errors / 31 pass |

## What was not verified

- **Supabase staging/production**: no credentials in this run. The new `supabaseStore`
  filter is static-inspected + typechecked only; it must be exercised by the guarded
  `npm run verify:staging` release gate (see `docs/staging-test-plan.md`).
- **Expired-token cleanup**: prod expired rows are filtered but not deleted; a vacuum or
  scheduled cleanup is optional, not required.
- macOS app behavior: not touched; unverified on Linux runner.

## Risk level

Low. Changes are additive, dev-store-only behavior plus one read-side query filter that only
rejects already-expired tokens. No schema change, no migration edit, no writes.

## Security and privacy impact

Positive: session expiry is now enforced in both store implementations, matching the
documented 30-day server-side policy. No new credentials, no data exposure, secret filtering
path untouched.

## Performance impact

None measurable. The Supabase filter adds one indexed column predicate
(`tokens_expiry_idx` exists); the dev store lookup is still O(1).

## Manual review steps

1. Read `web/src/data/memoryStore.ts` (`SESSION_TTL_MS`, `userForToken`, constructor migration).
2. Read `web/src/data/supabaseStore.ts` `userForToken` (`gte('expires_at', …)`).
3. Run `npm --prefix web run typecheck && npm --prefix web test`.
4. In staging, sign in, confirm a token still resolves, then set `expires_at` to the past
   on that token and confirm the endpoint returns 401 (guarded suite covers this path).

## Rollback plan

Revert the three source/test files; the branch is independent of any schema change, so a
revert fully restores prior behavior with no data migration needed.

## Recommended next action

Founder enables "Allow GitHub Actions to create and approve pull requests", then merges this
branch into `main` (it also carries the web-test fix that makes `main` green). Deferred:
keyset history pagination (see stale `nightly-backend-and-sync-keyset-sync` branch) and
optionally switching `SupabaseStore` device flow to the atomic RPCs from migration `0006`
(current store re-implements the flow inline; static inspection notes the deviation).

## Overlap with other branches

- `opencode/nightly-backend-and-sync-stale-tests-20260807` — direct ancestor; subsumed by this branch.
- `opencode/nightly-backend-and-sync-keyset-sync` (2026-08-01, unmerged) — also touches
  session expiry + pagination; stale relative to `main` and not rebased; do not merge both.
