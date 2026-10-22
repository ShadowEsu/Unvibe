-- A webhook that dies mid-processing (function timeout, crash between claim and complete/fail)
-- used to stay 'processing' forever: Stripe's retries were answered "duplicate" and a paid
-- checkout never granted the plan. A claim is now a 5-minute lease. A retry after the lease
-- re-claims the event; inside the lease it is still a duplicate, so two deliveries never run at
-- once. 5 minutes is far above the webhook function's maximum duration.
-- Keep WEBHOOK_LEASE_MS in web/src/billing/memoryBillingStore.ts in lockstep.
-- Additive only: one nullable column, same function signature and grants.

alter table public.billing_webhook_events add column if not exists claimed_at timestamptz;

create or replace function public.claim_billing_webhook(p_event_id text, p_event_type text)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare v_status text;
begin
  insert into billing_webhook_events(stripe_event_id, event_type, claimed_at)
  values (p_event_id, p_event_type, now())
  on conflict (stripe_event_id) do update
    set status = 'processing', attempts = billing_webhook_events.attempts + 1, last_error = null, claimed_at = now()
    where billing_webhook_events.status = 'failed'
       or (billing_webhook_events.status = 'processing'
           and coalesce(billing_webhook_events.claimed_at, billing_webhook_events.received_at) < now() - interval '5 minutes')
  returning status into v_status;
  return v_status = 'processing';
end;
$$;

revoke all on function public.claim_billing_webhook(text, text) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook(text, text) to service_role;

-- Rollback (restores the 2026-07-16 behaviour; the column is harmless to keep):
-- create or replace function public.claim_billing_webhook(p_event_id text, p_event_type text)
-- returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
-- declare v_status text;
-- begin
--   insert into billing_webhook_events(stripe_event_id, event_type) values (p_event_id, p_event_type)
--   on conflict (stripe_event_id) do update
--     set status = 'processing', attempts = billing_webhook_events.attempts + 1, last_error = null
--     where billing_webhook_events.status = 'failed'
--   returning status into v_status;
--   return v_status = 'processing';
-- end;
-- $$;
-- alter table public.billing_webhook_events drop column if exists claimed_at;
