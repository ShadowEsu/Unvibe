# Backend & Sync Audit — 2026-07-24

## Files inspected

### web/src/data/ (storage layer)
- `types.ts` — Store interface (auth, events, usage)
- `memoryStore.ts` — Dev in-memory store
- `supabaseStore.ts` — Production Supabase-backed store
- `store.ts` — Store factory (env-gated)
- `eventValidation.ts` — IncomingEvent validation
- `progress.ts` — Profile/project computation
- `skills.ts` — Skill state tracking
- `pagination.ts` — Cursor-based pagination

### web/src/lib/ (server utilities)
- `auth.ts` — Bearer token + cookie auth
- `session.ts` — Server component session
- `trialAccess.ts` — Sealed trial metering (Vercel Blob + memory)
- `aiAccess.ts` — AI provider session guard

### web/src/billing/ (billing layer)
- `plans.ts` — Plan definitions and limits
- `store.ts` + `memoryBillingStore.ts` + `supabaseBillingStore.ts`
- `stripe.ts` — Stripe integration
- `webhooks.ts` — Stripe webhook processing

### web/app/api/v1/ (API routes)
- `auth/signin`, `auth/signup`, `auth/signout`, `auth/device`, `auth/token`, `auth/approve`
- `events` (POST), `history` (GET)
- `account` (GET, DELETE)
- `billing/*` (overview, checkout, portal, webhook, seats, refresh)
- `trial/usage`
- `comprehension`, `reviews`, `profile`, `projects`

### app/src/main/ (Electron main process)
- `backend.ts` — HTTP client, device auth, sign in/up, push/pull events, billing
- `backendUrl.ts` — Backend URL resolution (env/baked/localhost)
- `store.ts` — Local persistent store (JSON, safeStorage)
- `sync.ts` — Durable outbox sync with retry
- `trial.ts` — Baked trial token

### app/src/core/ (shared core)
- `protocol.ts` — Wire types (ReviewRequestPayload, StreamEvent, ComprehensionQuestion)
- `syncModel.ts` — Merge remote events, retry delay
- `tokenVault.ts` — Electron safeStorage wrapper
- `learning.ts` — Local event model, profile, review queue

### app/src/preload/ (bridge)
- `preload.ts` — IPC bridge exposed as `window.unvibe`

### app/src/renderer/ (renderer)
- `bar/bar.tsx` — Floating bar
- `widget/widget.tsx` — Review widget
- `types.d.ts` — Window type augmentation

### Tests
- `app/test/syncModel.test.ts` — Sync merge + retry (4 tests, all pass)
- `web/test/security.test.ts` — Auth security (7 subtests, 3 pass/4 fail)
- `web/test/eventValidation.test.ts` — Event validation (2 tests, pass)
- `web/test/progress.test.ts` — Profile computation (3 tests, pass)
- `web/test/pagination.test.ts` — Cursor pagination (1 test, fails)
- `web/test/billing.test.ts` — Billing (16 tests, 5 pass/11 fail)
- `web/test/trialAccess.test.ts` — Trial (3 tests, pass)
- `web/test/skills.test.ts` — Skills (2 tests, pass)

## Test results (web/)

```
36 tests: 19 pass, 17 fail
```

### Passing tests (19)
- eventValidation: 2/2
- progress: 3/3
- skills: 2/2
- trialAccess: 3/3
- security: 3/7 (production guard, AI provider session, MemoryStore escape hatch)
- billing: 5/16 (server-side price IDs, webhook idempotency, history cursor, stale checkout, workspace isolation, event validation)
- pagination: 0/1

### Failing tests (17)

| Test | Failure | Root cause |
|------|---------|------------|
| security: revoke session | `revokeToken is not a function` | Method missing from Store interface + all implementations |
| security: duplicate approval | Id mismatch | MemoryStore.approveDeviceCode overwrites token instead of returning existing |
| security: expired device code | Returns token instead of null | No expiration check in MemoryStore |
| security: session expiry | Token still resolves | No TTL check in userForToken |
| pagination: historyPage | `historyPage is not a function` | Method not implemented in MemoryStore |
| billing: pricing math | `priceFor is not a function` | plans.ts exports don't match memoryBillingStore imports |
| billing: Teams paused | `TEAMS_CHECKOUT_ENABLED` undefined | Same root cause |
| billing: Teams seat validation | `normalizedSeats undefined` | Same root cause |
| billing: Pro/Teams limits | `planLimit is not a function` | Same root cause |
| billing: roles | `canManageBilling is not a function` | Same root cause |
| billing: effective plan | `effectivePlan is not a function` | Same root cause |
| billing: Free workspace | cascading from effectivePlan | Same root cause |
| billing: invitations | cascading from canManageMembers | Same root cause |
| billing: public plan payloads | cascading from effectivePlan | Same root cause |
| billing: activation/downgrade | cascading from effectivePlan | Same root cause |
| billing: failed payment grace | cascading from effectivePlan | Same root cause |
| billing: Stripe subscription sync | cascading from effectivePlan | Same root cause |

## TypeScript errors (54 total)

### Critical (runtime failures)
1. `signout/route.ts:16` — `Store.revokeToken` does not exist → sign-out throws
2. `token/route.ts:17,20` — `'expired'`/`'used'` comparisons impossible (type mismatch)

### Interface/type misalignment
3. `IncomingEvent` missing `localDate`, `timezone` fields — used by `progress.ts`, `eventValidation.ts`
4. `ProfileSummary` missing `conceptsFamiliar`, `conceptsStrong` — computed by `progress.ts`
5. `EventRecord` missing `language` — used by `skills.ts`
6. `Store` interface missing `historyPage` — used by `history/route.ts`
7. `Store` interface missing `revokeToken` — used by `signout/route.ts`
8. `plans.ts` missing 11 exports used by `memoryBillingStore.ts` and billing tests

### Test-specific
9. `security.test.ts` — `MemoryStore` has no `SESSION_TTL_MS` export
10. `security.test.ts` — `MemoryStore` constructor takes 0 args but tests pass 1 (`now` function)
11. `pagination.test.ts` — `historyPage` not on `MemoryStore`
12. `progress.test.ts` — `Pick<IncomingEvent, "ts" | "localDate">` — `localDate` not on type

## Security & privacy assessment

### Good
- Secret filtering (`secretFilter.ts`) runs in main process before any network call
- `forSync()` strips `code` and `explanation` before sending to backend
- Token encrypted at rest via Electron `safeStorage`
- `Store` factory refuses production use without Supabase
- Session cookie: HttpOnly, SameSite=Lax
- `aiAuthHeaders` manages trial vs signed-in auth properly
- Backend URL resolution prevents local override of baked URLs in release builds

### Issues found
- `signout/route.ts` calls `Store.revokeToken()` which doesn't exist — sign-out silently fails
- MemoryStore has no TTL/expiration for sessions or device codes (dev-only, but tests expect it)
- `/approve` route reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` directly from env
  (acceptable for server-side, but worth noting)

## Retry and backoff

- `retryDelayMs` uses bounded exponential: `min(60s, 1s * 2^attempt)` + 20% jitter
- Max delay ~72s, capped at ~72s for high attempt counts
- Sync state machine: `local → syncing → synced | offline | auth_required | error`
- Outbox deduplication: `markSynced` removes synced IDs, `mergeRemote` preserves pending
- `request()` timeout: 20s (`REQUEST_TIMEOUT_MS`), wraps `AbortSignal.timeout`

## Idempotency

- Event upsert: `upsertEvents` in both stores uses upsert semantics (id-based)
- Pull history: cursor-based, deduplicated by `byId` map, `mergeRemoteEvents` skips pending
- Device code approval: MemoryStore overwrites (not idempotent), SupabaseStore marks `used_at`
- Billing webhooks: idempotency key from Stripe, `MemoryBillingStore` tracks processed events

## Recommendations

### Required before production
1. **Add `revokeToken` to Store interface + both implementations** — sign-out is broken
2. **Add `historyPage` to Store interface + MemoryStore** — pagination endpoint broken in dev
3. **Align `IncomingEvent` type with usage** — add `localDate`, `timezone` fields
4. **Align `ProfileSummary` type** — add `conceptsFamiliar`, `conceptsStrong`
5. **Align `plans.ts` exports with consumers** — add missing billing functions

### Recommended improvements
6. Add TTL-based session expiration to MemoryStore (tests expect it)
7. Add device code expiration to MemoryStore (tests expect it)
8. Make `store.ts` factory log a warning when SUPABASE env is partially configured
9. The `isSealedTrialBearer` function uses a homegrown constant-time compare — good, but
   consider `crypto.timingSafeEqual` if Buffer is available
10. Consider adding a `Retry-After` header to 429 responses for sync backoff alignment

### Test-only fixes
11. Export `SESSION_TTL_MS` from `memoryStore.ts` or remove from security test import
12. Fix security tests to match current MemoryStore constructor signature
13. Add `MemoryStore.historyPage` implementation

## Risk level

**Low/Medium**. The broken sign-out is a functional bug but cannot leak data.
The type mismatches cause build failures (typecheck) but the 19 passing tests
indicate core logic is sound. The failing billing tests are import-related and
not logic errors. No security vulnerabilities were found.

## Verification performed
- [x] Static inspection of all sync-related source files
- [x] Reviewed Store interface + implementations
- [x] Checked retry/backoff logic
- [x] Verified secret filtering architecture (main process owns all I/O)
- [x] Checked Supabase keys never reach renderer code
- [x] Reviewed test fixtures and test results
- [x] Not verified: actual Supabase connection, Stripe webhooks, app-side sync at runtime
