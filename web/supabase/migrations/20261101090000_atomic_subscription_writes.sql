-- Stripe event order enforced inside the subscription writes, and an index for the recorded-refund
-- lookup.
--
-- The webhook reads a subscription row, compares the event's Stripe `created` time with the row's
-- stripe_event_at, and then writes. Webhook claims are per event, so two deliveries for the same
-- subscription can run at once, and an older invoice.paid could overwrite a newer
-- customer.subscription.deleted between that read and the write. These two functions put the
-- comparison into the write:
--
--   * sync_subscription_if_not_older: one `insert ... on conflict (workspace_id) do update ... where`.
--     The row is replaced unless it holds the same stripe_subscription_id with a newer
--     stripe_event_at (or holds one when the input has none). The row lock orders two concurrent
--     writes, and Postgres re-checks the `where` against the row the first one committed, so the
--     older write changes nothing. A different subscription or payment on the workspace is not
--     compared by event time: Stripe's `created` orders the events of one object, and the webhook's
--     replace rules decide between two subscriptions, as before. Returns whether the row was written.
--   * cancel_subscription_by_provider_id: a cancel (deleted, a full refund, a lost dispute) always
--     applies, and stripe_event_at becomes greatest(stored, given), so it never moves back. A cancel
--     is final at Stripe; letting a newer write win against it would let a concurrent grant undo a
--     revocation.
--   * Both are security invoker with search_path = public, executable by service_role only. The
--     table's own privileges are unchanged.
--
-- billing_audit_refund_payment_intent_idx serves the recorded-refund lookup the webhook runs before
-- every Lifetime, Big Business and paid subscription grant (SupabaseBillingStore.paymentRefunded):
--   select id from billing_audit_log
--   where action = 'refund.full' and metadata->>'paymentIntentId' = $1 limit 1;
-- Without it every grant scans the audit log. The refund.full rows are security state: they refuse a
-- grant of a refunded payment, so they must never be pruned (docs/billing.md).
--
-- Order: apply after 20261031091000_subscriptions_stripe_event_at.sql (the functions write
-- stripe_event_at), then deploy the code that calls them. Code without these calls keeps working
-- once this is applied. The index build briefly blocks writes to billing_audit_log (a small table).
-- Safe to run twice.
--
-- Rollback (roll the code back first; it calls both functions):
--   drop function if exists public.sync_subscription_if_not_older(uuid, text, text, text, integer, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean);
--   drop function if exists public.cancel_subscription_by_provider_id(text, timestamptz);
--   drop index if exists public.billing_audit_refund_payment_intent_idx;

create or replace function public.sync_subscription_if_not_older(
  p_workspace_id uuid,
  p_plan text,
  p_interval text,
  p_status text,
  p_seats integer,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_grace_period_ends_at timestamptz,
  p_stripe_event_at timestamptz,
  p_cancel_at_period_end boolean
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare v_rows integer;
begin
  insert into subscriptions as s (
    workspace_id, plan, interval, status, seats, stripe_customer_id, stripe_subscription_id, stripe_price_id,
    current_period_start, current_period_end, grace_period_ends_at, stripe_event_at, cancel_at_period_end, updated_at
  ) values (
    p_workspace_id, p_plan, p_interval, p_status, p_seats, p_stripe_customer_id, p_stripe_subscription_id, p_stripe_price_id,
    p_current_period_start, p_current_period_end, p_grace_period_ends_at, p_stripe_event_at, p_cancel_at_period_end, now()
  )
  on conflict (workspace_id) do update set
    plan = excluded.plan,
    interval = excluded.interval,
    status = excluded.status,
    seats = excluded.seats,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    grace_period_ends_at = excluded.grace_period_ends_at,
    stripe_event_at = excluded.stripe_event_at,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = excluded.updated_at
  where s.stripe_subscription_id is distinct from excluded.stripe_subscription_id
     or s.stripe_event_at is null
     or s.stripe_event_at <= excluded.stripe_event_at;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.cancel_subscription_by_provider_id(p_stripe_subscription_id text, p_stripe_event_at timestamptz)
returns void
language sql
security invoker
set search_path = public
as $$
  update subscriptions
  set status = 'canceled', updated_at = now(), stripe_event_at = greatest(stripe_event_at, p_stripe_event_at)
  where stripe_subscription_id = p_stripe_subscription_id;
$$;

revoke all on function public.sync_subscription_if_not_older(uuid, text, text, text, integer, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.sync_subscription_if_not_older(uuid, text, text, text, integer, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, boolean) to service_role;
revoke all on function public.cancel_subscription_by_provider_id(text, timestamptz) from public, anon, authenticated;
grant execute on function public.cancel_subscription_by_provider_id(text, timestamptz) to service_role;

create index if not exists billing_audit_refund_payment_intent_idx
  on public.billing_audit_log (action, (metadata->>'paymentIntentId'));
