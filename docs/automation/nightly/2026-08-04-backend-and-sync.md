# Night Lab report — backend-and-sync (2026-08-04)

Mission: `backend-and-sync` (scheduled 11:17 UTC run missed today; executed as the
"auto" slot at 18:06 UTC). Branch: `opencode/nightly-auto-backend-and-sync-20260804`.

## Status

Static security and data-flow inspection of the auth/account/sync/storage surface
(`web/src` + `app/src/main` + `app/src/preload`). Verified secrets never reach the
renderer, reviewed retry/backoff/idempotency, and added one low-risk regression test
for the privacy-critical `forSync` strip-before-sync contract. No database access was
used (no credentials available). `web/` remains red on `main` with the same
pre-existing breakage tracked since 2026-07-29; the verified fix still sits unmerged
on `opencode/nightly-backend-and-sync-web-contract-alignment`.

## Key findings

### Secrets never reach renderer code — VERIFIED CLEAN

- `app/src/preload/preload.ts` exposes a fixed allowlist of IPC methods. No token, API
  key, or Supabase value is passed over the bridge. Renderer never performs network I/O.
- `app/src/main/backend.ts` owns ALL network calls. `aiAuthHeaders` supplies the session
  bearer or the sealed trial token + install id only inside the main process.
- `app/src/main/store.ts` persists the bearer token encrypted with Electron `safeStorage`
  (`sealToken`/`openToken` in `app/src/core/tokenVault.ts`). It fails closed if the OS
  keychain is unavailable (pre-0.1.0 plaintext tokens are discarded on load).
- `app/src/main/aiKey.ts` stores the user-supplied provider key encrypted with
  `safeStorage` and only ever used for direct provider calls from main.
- `web/src/data/supabaseStore.ts` holds `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Renderer-side grep for `SUPABASE_*` / `ANTHROPIC_API_KEY` / `api_key` returns only
  marketing copy and mock-AI labels — no credential access.

### Privacy: backend never reads the repo — VERIFIED CLEAN, now TESTED

- `forSync` (`app/src/core/learning.ts:80`) destructures out `code` and `explanation`
  before `pushEvents` sends records to the cloud. This is the load-bearing rule "the
  backend never reads the repository."
- **Gap fixed:** this contract had no regression test. Added one in
  `app/test/learning.test.ts` asserting `code`/`explanation` are stripped while id/scope/
  level/outcome/concept/file/project survive. (This closes the loop on
  `review.ts:recordReview` which stores code + explanation on-device.)
- `pullEvents` uses stable cursors, dedupes by id, detects repeated cursors, and
  `mergeRemote` keeps newer local outbox events and local lesson bodies over the cloud
  mirror — correct and unit-tested.

### Retry / backoff / idempotency — REVIEWED

- `app/src/main/sync.ts`: bounded exponential backoff with jitter
  (`retryDelayMs`, capped at 60s base), retry timer, `syncAbort` cancellation, and a
  single in-flight guard (`inFlight`). Phases: `local | syncing | synced | offline |
  auth_required | error`. Offline/error retries are scheduled; expired-session and
  cancellation stop the loop. Looks correct.
- Event sync is idempotent end-to-end: `upsertEvents` upserts by event `id`
  (Supabase `onConflict: 'id'`; MemoryStore replace-by-id), so re-push after a failed
  ack cannot duplicate records.
- `web/app/api/v1/auth/token/route.ts` handles `'expired'`/`'used'` redeem states that
  the current stores never return — a known symptom of the pre-existing contract
  breakage, fixed by the unmerged `web-contract-alignment` branch (10-min device-code
  TTL, one-time redemption, 30-day opaque-session TTL in `MemoryStore`).
- Trial metering (`web/src/lib/trialAccess.ts`) uses constant-time token compare,
  per-install hashed keys, a shared global monthly ceiling, and durable counters via
  Vercel Blob with in-memory fallback. Global-usage increment is not atomic under
  concurrent writes (Blob read-modify-write) — flagged, not changed (low-risk, out of
  this mission's scope).

## Files changed

- `app/test/learning.test.ts` — added `forSync` regression test (+1).

## Tests actually run (exact)

- `app` `npm install` ok · `npm run typecheck` **pass** · `npm test` **32/32 pass**
  (31 pre-existing + 1 new `forSync` test) · `npm run build` ok.
- `web` `npm run typecheck` **8 errors** (pre-existing: `priceFor`,
  `proAnnualSavingsPercent`, `teamsAnnualSavingsPercent`, `SESSION_TTL_MS` missing;
  `planLimit`/`MemoryStore` arity) · `npm test` **31/36 pass** (5 fail, pre-existing:
  billing pricing math, Teams seat validation, duplicate device-approval idempotency,
  expired device-code, opaque-session expiry) · `npm run build` **ok**.
- `web` was re-verified to confirm the breakage is unchanged; not re-fixed here to avoid
  a second overlapping copy of the `web-contract-alignment` fix.

## What was not verified

- `SupabaseStore` runtime behavior (no `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  credentials). Static inspection only.
- Manual staging verification (device-code lifecycle, session expiry, account deletion)
  — documented in `docs/staging-test-plan.md`; requires a staging environment.
- Concurrent global trial-limit atomicity (see findings).

## Risk level

**Low.** Test-only change in the app package. No production code, schema, or dependency
changes. No DB operations run.

## Security and privacy impact

Positive. The added test hardens the privacy guarantee that code and explanation never
leave the device. No secrets touched; renderer holds no network access.

## Performance impact

None.

## Manual review steps

1. Review `app/test/learning.test.ts` `forSync` test.
2. Optionally review the flagged global trial-meter increment in `web/src/lib/trialAccess.ts`.
3. For staging verification of the auth/sync contract, follow `docs/staging-test-plan.md`.

## Rollback plan

Revert `app/test/learning.test.ts` to restore prior state (test-only, no behavioral risk).

## Recommended next action

Merge `opencode/nightly-backend-and-sync-web-contract-alignment` (verified green) to
turn `web/` green on `main`, then reconcile the stale overlapping web-fix branches per
the 2026-08-04 integration-review summary. Unblock night-lab PR creation (repo setting)
so pushed branches stop depending on manual PR creation.
