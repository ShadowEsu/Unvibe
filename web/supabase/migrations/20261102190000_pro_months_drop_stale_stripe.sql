begin;

-- add_pro_months, re-declared with one change (Security R8-1, 26 Oct): a grant onto a canceled or
-- inactive Stripe row clears that row's old stripe_subscription_id and stripe_price_id. Before, the
-- row kept the old subscription id while it became complimentary `trialing` Pro, so a stop retry or a
-- late customer.subscription.deleted for the old subscription found the row by that id and marked it
-- canceled, wiping the free months. stripe_customer_id is kept so a later checkout reuses the customer.
-- Everything else is line for line 20261026090000_promo_codes.sql (row lock, stacking, 12-month cap);
-- create or replace keeps its grants (none for public, anon or authenticated).
create or replace function public.add_pro_months(p_user_id uuid, p_months integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_sub subscriptions%rowtype;
  v_from timestamptz := now();
begin
  if p_months is null or p_months <= 0 then return false; end if;
  v_workspace_id := ensure_personal_workspace(p_user_id);
  select * into strict v_sub from subscriptions where workspace_id = v_workspace_id for update;
  if v_sub.stripe_subscription_id is not null and v_sub.status not in ('canceled', 'inactive') then
    return false;
  end if;
  if v_sub.plan = 'pro' and v_sub.status = 'trialing' and v_sub.current_period_end > now() then
    v_from := v_sub.current_period_end;
  end if;
  update subscriptions
    set plan = 'pro',
        interval = 'monthly',
        status = 'trialing',
        seats = 1,
        stripe_subscription_id = null,
        stripe_price_id = null,
        current_period_start = case when v_from > now() then coalesce(current_period_start, now()) else now() end,
        current_period_end = least(v_from + make_interval(days => 30 * p_months), now() + interval '12 months'),
        updated_at = now()
    where workspace_id = v_workspace_id;
  return true;
end;
$$;
-- Repeated so this file alone leaves it callable only by the service role.
revoke all on function public.add_pro_months(uuid, integer) from public, anon, authenticated;

commit;
