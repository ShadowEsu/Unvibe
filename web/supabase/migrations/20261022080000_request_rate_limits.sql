-- Shared request limits for the marketing site's public signup forms (waitlist, beta download).
-- Limits used to live in each serverless instance's memory, so every cold start or extra
-- instance reset them. This counts calls (not rows) per bucket per fixed window.
-- Buckets are "<rule>:<sha256 prefix>"; raw IPs and emails are never stored.
-- Public roles have no table or function access; server routes use the service-role key.
--
-- Rollback:
--   drop function if exists public.consume_rate_limit(text, integer, integer);
--   drop table if exists public.request_rate_limits;

create table if not exists public.request_rate_limits (
  bucket       text        not null check (length(bucket) between 1 and 200),
  window_start timestamptz not null,
  hits         integer     not null default 0 check (hits >= 0),
  primary key (bucket, window_start)
);

create index if not exists request_rate_limits_window_start_idx
  on public.request_rate_limits (window_start);

alter table public.request_rate_limits enable row level security;

-- Counts this call and returns true while the bucket is within p_max for the current window.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_window_seconds integer,
  p_max integer
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_bucket is null or length(p_bucket) not between 1 and 200
     or p_window_seconds is null or p_window_seconds not between 1 and 86400
     or p_max is null or p_max < 1 then
    raise exception 'invalid rate limit arguments';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.request_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Occasional cleanup keeps the table small without a scheduled job.
  if random() < 0.01 then
    delete from public.request_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke all on table public.request_rate_limits from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
-- The function is security invoker, so the service role needs the table rights it uses.
grant select, insert, update, delete on table public.request_rate_limits to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
