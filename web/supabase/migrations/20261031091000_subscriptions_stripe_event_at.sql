-- The Stripe `created` time of the last webhook event applied to a subscription row (a recurring
-- subscription, or a one-time Lifetime/Big Business payment stored under its PaymentIntent id). The
-- webhook ignores an event older than it, so a late or retried delivery can no longer restore access
-- that a newer refund, dispute or cancellation took away.
-- Nullable, no default, no backfill: a row without it accepts the next event.
-- Apply before deploying the code that writes it: the server upserts `stripe_event_at` and fails
-- every subscription write while the column is missing (docs/billing.md).
-- Safe to run twice.
-- Rollback: alter table public.subscriptions drop column if exists stripe_event_at;

alter table public.subscriptions add column if not exists stripe_event_at timestamptz;
