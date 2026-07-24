# Backend & Sync — Manual Staging Verification Steps

> Generated: 2026-07-24 by OpenCode Night Lab (backend-and-sync mission)
> Static inspection only — no database credentials available.
> All steps require a running web/ dev instance (`npm run dev` in web/) and
> (for Supabase tests) `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Prerequisites

- `web/` dev server running at http://localhost:8787 (or `UNVIBE_BACKEND` override)
- For supabase-backed flows: valid `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `web/.env`
- For AI-dependent flows: `ANTHROPIC_API_KEY` (or app mock mode)
- `app/` running locally (`npm start` in app/)

## 1. Auth flows

### 1.1 Email sign-up (MemoryStore)
```bash
curl -s -X POST http://localhost:8787/api/v1/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.dev"}'
```
Expected: `200` with `{ token, userId, email }`. A session cookie is set.

### 1.2 Email sign-in (existing user)
```bash
curl -s -X POST http://localhost:8787/api/v1/auth/signin \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.dev"}'
```
Expected: `200` with `{ token, userId, email }`.

### 1.3 Sign-in with unrecognised email (MemoryStore auto-creates)
```bash
curl -s -X POST http://localhost:8787/api/v1/auth/signin \
  -H 'content-type: application/json' \
  -d '{"email":"new-user@example.dev"}'
```
Expected: `200` (MemoryStore creates account on sign-in).

### 1.4 Sign-in/up disabled in production without UNCODE_ALLOW_DEV_EMAIL_AUTH
```bash
NODE_ENV=production curl -s -X POST http://localhost:8787/api/v1/auth/signin \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.dev"}'
```
Expected: `501` — Cloud sign-in not configured.

### 1.5 Device auth flow
```bash
# Step 1: create device code
curl -s -X POST http://localhost:8787/api/v1/auth/device
```
Expected: `200` with `{ deviceCode, userCode, verificationUri, interval }`.

```bash
# Step 2: poll for token (before approval)
DEVICE_CODE="<from step 1>"
curl -s -X POST http://localhost:8787/api/v1/auth/token \
  -H 'content-type: application/json' \
  -d '{"deviceCode":"'$DEVICE_CODE'"}'
```
Expected: `202` `{ status: "pending" }`.

```bash
# Step 3: approve (requires Supabase auth session)
# This step requires signing in via Supabase Auth first, then:
curl -s -X POST http://localhost:8787/api/v1/auth/approve \
  -H 'authorization: Bearer <supabase-access-token>' \
  -H 'content-type: application/json' \
  -d '{"userCode":"<userCode from step 1>"}'
```
Expected: `200` `{ ok: true }`.

```bash
# Step 4: poll again (after approval)
curl -s -X POST http://localhost:8787/api/v1/auth/token \
  -H 'content-type: application/json' \
  -d '{"deviceCode":"'$DEVICE_CODE'"}'
```
Expected: `200` with `{ token: "<bearer-token>" }`.

### 1.6 Sign-out
```bash
TOKEN="<bearer token>"
curl -s -X POST http://localhost:8787/api/v1/auth/signout \
  -H 'authorization: Bearer '$TOKEN''
```
Expected: `200` `{ ok: true }`. Subsequent requests with this token should return `401`.

**⚠ KNOWN ISSUE**: `revokeToken` is called in `signout/route.ts` but is not implemented
in `MemoryStore`, `SupabaseStore`, or the `Store` interface. The sign-out route will
throw at runtime. See the audit report for the fix needed.

### 1.7 Unauthorised access
```bash
curl -s http://localhost:8787/api/v1/account
curl -s http://localhost:8787/api/v1/events \
  -X POST -H 'content-type: application/json' -d '{"events":[]}'
curl -s http://localhost:8787/api/v1/history
```
Expected: All return `401` `{ error: "unauthorized" }`.

## 2. Account lifecycle

### 2.1 Account info
```bash
TOKEN="<bearer token>"
curl -s http://localhost:8787/api/v1/account \
  -H 'authorization: Bearer '$TOKEN''
```
Expected: `200` `{ userId, email? }`.

### 2.2 Account deletion (no active subscription)
```bash
curl -s -X DELETE http://localhost:8787/api/v1/account \
  -H 'authorization: Bearer '$TOKEN''
```
Expected: `200` `{ ok: true }`. Subsequent requests with this token return `401`.

### 2.3 Account deletion blocked by active subscription
Requires a billing workspace with an active Stripe subscription.
Expected: `409` with `{ error: "active_subscription", message }`.

## 3. Events / Sync

### 3.1 Post learning events
```bash
TOKEN="<bearer token>"
curl -s -X POST http://localhost:8787/api/v1/events \
  -H 'authorization: Bearer '$TOKEN'' \
  -H 'content-type: application/json' \
  -d '{"events":[{"id":"e2e-001","ts":"2026-07-24T10:00:00Z","scope":"selection","level":"intermediate","outcome":"understood"}]}'
```
Expected: `200` `{ ok: true, count: 1 }`.

### 3.2 Reject malformed events
```bash
# Missing id
curl -s -X POST http://localhost:8787/api/v1/events \
  -H 'authorization: Bearer '$TOKEN'' \
  -H 'content-type: application/json' \
  -d '{"events":[{"ts":"2026-07-24T10:00:00Z"}]}'
```
Expected: `400` `{ error: "events must contain at most 500 valid activity records" }`.

```bash
# Not an array
curl -s -X POST http://localhost:8787/api/v1/events \
  -H 'authorization: Bearer '$TOKEN'' \
  -H 'content-type: application/json' \
  -d '{"events":"not-an-array"}'
```
Expected: `400` `{ error: "missing events[]" }`.

```bash
# Too many events
curl -s -X POST http://localhost:8787/api/v1/events \
  -H 'authorization: Bearer '$TOKEN'' \
  -H 'content-type: application/json' \
  -d '{"events":[]}'  # produce array of 501 items
```
Expected: `400`.

### 3.3 History (cursor pagination)
```bash
curl -s "http://localhost:8787/api/v1/history?limit=50" \
  -H 'authorization: Bearer '$TOKEN''
```
Expected: `200` with `{ events: [...], nextCursor?: "string" }`.

```bash
# Paginate with cursor
curl -s "http://localhost:8787/api/v1/history?limit=50&cursor=<nextCursor>" \
  -H 'authorization: Bearer '$TOKEN''
```
Expected: `200` with next page or empty events array.

### 3.4 Idempotent event upsert
```bash
curl -s -X POST http://localhost:8787/api/v1/events \
  -H 'authorization: Bearer '$TOKEN'' \
  -H 'content-type: application/json' \
  -d '{"events":[{"id":"e2e-001","ts":"2026-07-24T10:00:00Z","scope":"selection","level":"intermediate","outcome":"understood","concept":"test-concept"}]}'
# Then post again with different outcome:
curl -s -X POST http://localhost:8787/api/v1/events \
  -H 'authorization: Bearer '$TOKEN'' \
  -H 'content-type: application/json' \
  -d '{"events":[{"id":"e2e-001","ts":"2026-07-24T10:00:00Z","scope":"selection","level":"intermediate","outcome":"needs_review"}]}'
# History should return the updated (second) version:
curl -s "http://localhost:8787/api/v1/history" \
  -H 'authorization: Bearer '$TOKEN''
```
Expected: Event e2e-001 has `outcome: "needs_review"`.

## 4. App-side sync (requires running desktop app)

### 4.1 Outbox persistence
- Disconnect network (airplane mode / firewall)
- Review some code in the app (trigger explanation)
- Verify the learning event is stored locally:
  `~/Library/Application Support/Unvibe/unvibe-store.json`
- Check `pending` count is non-zero via `window.unvibe.syncStatus()`

### 4.2 Sync on reconnect
- Reconnect network
- Call `window.unvibe.retrySync()` or wait for the retry timer
- Verify `phase` transitions: `local` → `syncing` → `synced` (or `error`)
- Check backend history includes the new event

### 4.3 Offline retry with backoff
- Kill the backend, review code, verify outbox grows
- Observe retry delay (bounded exponential: 1s → 2s → 4s … capped at ~72s)
- Restart backend, verify sync completes

### 4.4 Auth-required state
- Sign out in the app
- Verify sync phase becomes `auth_required`
- Sign back in, verify sync resumes

### 4.5 Sync conflict resolution
- Create an event in the app, then offline-update its outcome
- Before syncing, upsert the same event ID via the backend API with a different outcome
- Reconnect and sync
- Verify local state (not remote) wins for outbox events

## 5. Trial usage metering

### 5.1 Trial usage overview
```bash
curl -s http://localhost:8787/api/v1/trial/usage \
  -H 'authorization: Bearer <trial-token>' \
  -H 'x-unvibe-install-id: test-install-12345'
```
Expected: `200` with plan and usage lines.

### 5.2 Exhausted trial returns 429
Exhaust the monthly limit, then make another request.
Expected: `429` with `plan_limit_reached`.

## 6. Billing

### 6.1 Billing overview
```bash
curl -s http://localhost:8787/api/v1/billing/overview \
  -H 'authorization: Bearer '$TOKEN''
```
Expected: `200` with workspace, subscription, usage.

### 6.2 Checkout
```bash
curl -s -X POST http://localhost:8787/api/v1/billing/checkout \
  -H 'authorization: Bearer '$TOKEN'' \
  -H 'content-type: application/json' \
  -d '{"plan":"pro","interval":"monthly","seats":1}'
```
Expected: `200` with `{ url }`.

### 6.3 Teams not available
```bash
curl -s -X POST http://localhost:8787/api/v1/billing/checkout \
  -H 'authorization: Bearer '$TOKEN'' \
  -H 'content-type: application/json' \
  -d '{"plan":"teams","interval":"monthly","seats":3}'
```
Expected: `409` with error message.

## 7. Privacy & security verification

### 7.1 Secret filtering before network call
- In the app, select code containing `API_KEY=sk-...`
- Verify the secret filter blocks the request (phase: `blocked`)
- Verify no network call was made (check backend access logs)

### 7.2 Code/explanation never synced
- Post events with `code` and `explanation` fields (these are typed as LocalEvent
  on the app side)
- Verify the `forSync()` function strips these before sending
- Check the backend history response never contains `code` or `explanation`

### 7.3 Supabase keys never reach renderer
- Open the renderer process DevTools
- Search `window.unvibe` for any `SUPABASE` or `service_role` values
- Verify only IPC calls are exposed — no database connections

### 7.4 Token encrypted at rest
- Check `~/Library/Application Support/Unvibe/unvibe-store.json`
- The `tokenEnc` field should be base64 ciphertext, not a plaintext token
- If `tokenEncrypted` is `false`, the token was explicitly deleted on load

## 8. Error handling & resilience

### 8.1 Backend unavailable
- Stop the web server
- Try a review in the app
- Verify timeout error after ~20s (`REQUEST_TIMEOUT_MS`)
- Verify app shows error state, does not crash

### 8.2 401 session expired
- Modify or expire the bearer token server-side
- Make an API request from the app
- Verify `auth_required` phase

### 8.3 429 rate limit
- Exhaust usage limits
- Verify error message includes usage info and upgrade path

## Known type/fixture issues (from audit)

### Missing Store methods
- `revokeToken()` — called by `signout/route.ts`, tested by `security.test.ts`,
  not implemented in `Store` interface, `MemoryStore`, or `SupabaseStore`
- `historyPage()` — called by `history/route.ts`, tested by `pagination.test.ts`,
  not in `Store` interface or `MemoryStore` (it's in `SupabaseStore`?)

### Type mismatches
- `IncomingEvent` type missing `localDate`, `timezone` fields used in `progress.ts`
- `ProfileSummary` missing `conceptsFamiliar`, `conceptsStrong` used in `progress.ts`
- `EventRecord` missing `language` used in `skills.ts`
- Billing `plans.ts` missing exports used by `memoryBillingStore.ts` and tests
  (`canManageBilling`, `canManageMembers`, `effectivePlan`, `normalizedSeats`, etc.)
- `MemoryStore` constructor doesn't accept the `now` parameter used in security tests

### Security test assumptions not met
- `SESSION_TTL_MS` not defined in `memoryStore.ts` — test cannot import it
- `MemoryStore` has no expiration logic for tokens or device codes
- Device code `redeemDeviceCode` never returns `'expired'` or `'used'` states
  (`token/route.ts` checks for these)

## Verification status
- [ ] 1.1 Email sign-up (MemoryStore)
- [ ] 1.2 Email sign-in (existing user)
- [ ] 1.3 Sign-in with unrecognised email
- [ ] 1.4 Sign-in disabled in production
- [ ] 1.5 Device auth flow
- [ ] 1.6 Sign-out (KNOWN ISSUE: `revokeToken` missing)
- [ ] 1.7 Unauthorised access
- [ ] 2.1 Account info
- [ ] 2.2 Account deletion (no subscription)
- [ ] 2.3 Account deletion blocked by active subscription
- [ ] 3.1 Post learning events
- [ ] 3.2 Reject malformed events
- [ ] 3.3 History cursor pagination
- [ ] 3.4 Idempotent event upsert
- [ ] 4.1–4.5 App-side sync (requires running desktop app)
- [ ] 5.1–5.2 Trial usage metering
- [ ] 6.1–6.3 Billing flows
- [ ] 7.1–7.4 Privacy & security verification
- [ ] 8.1–8.3 Error handling & resilience
