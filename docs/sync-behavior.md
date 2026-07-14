# Sync behavior

The desktop app writes each review locally first. Each record has a UUID, is added once to the
outbox, and is POSTed to `POST /api/v1/events` after sign-in. The backend upserts by event ID,
which makes retrying the same event idempotent. Failed requests remain in the outbox and retry on
the next review or app focus.

Current limitations before staging: there is no exponential-backoff scheduler, remote pull, or
failed-sync status UI. Signing out deliberately clears the outbox while preserving local learning.
Those limitations must be resolved or explicitly accepted before multi-device beta claims.
