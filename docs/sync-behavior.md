# Sync behavior

Status: implemented locally; real Supabase/offline-restart verification still required.

The desktop writes each learning record to an atomic local JSON store first. Records use a
client-generated UUID and are queued in an identity-bound outbox. The backend validates each
record and upserts by stable event ID. Retrying an accepted event therefore does not create a
duplicate.

When an account is available, a sync cycle:

1. uploads the current outbox;
2. removes only IDs the backend accepted;
3. downloads up to 500 remote records;
4. merges by event ID, preserving any local record still waiting to upload; and
5. publishes `synced`, `offline`, `error`, or `auth_required` status to the companion UI.

Network and server failures keep work queued and schedule bounded exponential retry with jitter.
The companion displays the pending count and offers manual retry. A 401 stops automatic retry and
asks for sign-in instead of looping forever. The outbox survives app restart and sign-out; it stays
bound to its original account so signing into a different account cannot upload the prior user's
queued records.

Verified in deterministic tests: backoff bounds, duplicate-safe merge, preservation of unsynced
local updates, server idempotency in MemoryStore, and remote API push/reload. Still unverified:
process-kill restart while offline, reconnect against Supabase, and two-device conflict behavior.
