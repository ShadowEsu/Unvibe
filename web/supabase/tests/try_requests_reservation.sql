-- Checks for public.reserve_try_request and public.try_requests
-- (migration 20261028090000_try_requests_reservation.sql).
--
-- Run it on a scratch or local database that has Supabase's roles (anon, authenticated,
-- service_role) and every migration in ../migrations applied. Never on production: the behaviour
-- checks insert rows and take the Try lock while they run.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f web/supabase/tests/try_requests_reservation.sql
--
-- Plain SQL with no extensions or psql meta-commands, so a multi-statement query from any client runs
-- it too. Each check is a DO block that raises on failure. It leaves nothing behind: every transaction
-- ends in rollback.
-- Blocks 2 and 3 take the Try lock, so they set idle_in_transaction_session_timeout = 5s: a client that
-- leaves one idle after a failure loses its session after 5 s, and the lock with it.
--
-- The concurrency guarantee itself (a burst of concurrent calls at a cap admits exactly one) needs
-- many connections at once, which one script can't open; the lock checks below pin the mechanism:
-- a call that may insert holds the advisory lock, and a capped call never takes it.

-- 1. Catalog: who may call the function and touch the table, and how the function is declared.
begin;
do $$
declare
  fn constant text := 'public.reserve_try_request(text, integer, integer)';
  r text;
  p record;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_function_privilege(r, fn, 'execute') then
      raise exception '% can execute reserve_try_request', r;
    end if;
    if has_table_privilege(r, 'public.try_requests', 'select')
      or has_table_privilege(r, 'public.try_requests', 'insert')
      or has_table_privilege(r, 'public.try_requests', 'truncate') then
      raise exception '% holds select, insert or truncate on try_requests', r;
    end if;
    if has_sequence_privilege(r, 'public.try_requests_id_seq', 'usage') then
      raise exception '% holds usage on try_requests_id_seq', r;
    end if;
  end loop;

  if not has_function_privilege('service_role', fn, 'execute') then
    raise exception 'service_role cannot execute reserve_try_request';
  end if;
  if not (has_table_privilege('service_role', 'public.try_requests', 'select')
      and has_table_privilege('service_role', 'public.try_requests', 'insert')) then
    raise exception 'service_role lacks select or insert on try_requests';
  end if;

  select prosecdef, provolatile, proconfig into p from pg_proc where oid = fn::regprocedure;
  if p.prosecdef then
    raise exception 'reserve_try_request is security definer';
  end if;
  if p.provolatile <> 'v' then
    raise exception 'reserve_try_request is not volatile (provolatile %)', p.provolatile;
  end if;
  if not coalesce(p.proconfig @> array['search_path=public, pg_temp', 'lock_timeout=1s'], false) then
    raise exception 'reserve_try_request proconfig is %, want search_path=public, pg_temp and lock_timeout=1s', p.proconfig;
  end if;
end;
$$;
rollback;

-- 2. Lock: a capped call refuses before the lock; a call that inserts holds it. The key
-- 8390902506592760694 shows in pg_locks as classid = high 32 bits, objid = low 32 bits, objsubid 1.
begin;
set local idle_in_transaction_session_timeout = '5s';
set local role service_role;
do $$
declare
  h constant text := md5(random()::text || clock_timestamp()::text);
  v_day bigint;
  v text;
begin
  insert into public.try_requests (ip_hash, created_at)
  select h, now() - interval '10 minutes' from generate_series(1, 6);

  v := public.reserve_try_request(h, 6, 1000000000);
  if v <> 'hour_cap' then
    raise exception 'lock: a visitor with 6 rows got %, want hour_cap', v;
  end if;
  if exists (select 1 from pg_locks where pid = pg_backend_pid() and locktype = 'advisory') then
    raise exception 'lock: an hour_cap answer took an advisory lock (no early refusal)';
  end if;

  select count(*) into v_day from public.try_requests where created_at >= now() - interval '1 day';
  v := public.reserve_try_request(md5(random()::text || clock_timestamp()::text), 6, v_day::integer);
  if v <> 'day_cap' then
    raise exception 'lock: a call at the day cap got %, want day_cap', v;
  end if;
  if exists (select 1 from pg_locks where pid = pg_backend_pid() and locktype = 'advisory') then
    raise exception 'lock: a day_cap answer took an advisory lock (no early refusal)';
  end if;

  v := public.reserve_try_request(md5(random()::text || clock_timestamp()::text), 6, v_day::integer + 1000);
  if v <> 'ok' then
    raise exception 'lock: an uncapped call got %, want ok', v;
  end if;
  if not exists (
    select 1 from pg_locks
    where pid = pg_backend_pid() and locktype = 'advisory' and granted
      and classid = 1953659231 and objid = 1919251318 and objsubid = 1
  ) then
    raise exception 'lock: an ok answer does not hold the advisory lock 8390902506592760694';
  end if;
end;
$$;
rollback;

-- 3. Caps and arguments, as the API's role. The day cap is passed relative to the rows already in the
-- last day, so existing rows can't break the checks.
begin;
set local idle_in_transaction_session_timeout = '5s';
set local role service_role;
do $$
declare
  h constant text := md5(random()::text || clock_timestamp()::text);
  old constant text := md5(random()::text || clock_timestamp()::text);
  v_day bigint;
  v_rows bigint;
  v text;
  bad text;
  caps integer[];
begin
  select count(*) into v_day from public.try_requests where created_at >= now() - interval '1 day';

  -- Hour cap: 5 rows in the last hour, then ok (the 6th), then hour_cap with no new row.
  insert into public.try_requests (ip_hash, created_at)
  select h, now() - interval '10 minutes' from generate_series(1, 5);
  v := public.reserve_try_request(h, 6, v_day::integer + 1000);
  if v <> 'ok' then
    raise exception 'hour cap: 5 rows, got %, want ok', v;
  end if;
  v := public.reserve_try_request(h, 6, v_day::integer + 1000);
  if v <> 'hour_cap' then
    raise exception 'hour cap: 6 rows, got %, want hour_cap', v;
  end if;
  select count(*) into v_rows from public.try_requests where ip_hash = h;
  if v_rows <> 6 then
    raise exception 'hour cap: % rows for the hash, want 6', v_rows;
  end if;

  -- Rows older than an hour don't count for the hash.
  insert into public.try_requests (ip_hash, created_at)
  select old, now() - interval '61 minutes' from generate_series(1, 6);
  v := public.reserve_try_request(old, 6, v_day::integer + 1000);
  if v <> 'ok' then
    raise exception 'hour cap: 6 rows older than an hour, got %, want ok', v;
  end if;

  -- Day cap: ok at the day count plus one, then day_cap.
  select count(*) into v_day from public.try_requests where created_at >= now() - interval '1 day';
  v := public.reserve_try_request(md5(random()::text || clock_timestamp()::text), 6, v_day::integer + 1);
  if v <> 'ok' then
    raise exception 'day cap: one under, got %, want ok', v;
  end if;
  v := public.reserve_try_request(md5(random()::text || clock_timestamp()::text), 6, v_day::integer + 1);
  if v <> 'day_cap' then
    raise exception 'day cap: at the cap, got %, want day_cap', v;
  end if;

  -- 22023 for a hash that isn't 32 lowercase hex characters, or a cap under 1 or null.
  foreach bad in array array['', 'not a hash', upper(h), left(h, 31), h || '0', h || E'\n', '203.0.113.7'] loop
    begin
      perform public.reserve_try_request(bad, 6, 500);
      raise exception 'bad hash % was accepted', bad using errcode = 'P0001';
    exception when sqlstate '22023' then
      null;
    end;
  end loop;
  begin
    perform public.reserve_try_request(null, 6, 500);
    raise exception 'a null hash was accepted' using errcode = 'P0001';
  exception when sqlstate '22023' then
    null;
  end;
  foreach caps slice 1 in array array[[0, 500], [-1, 500], [null, 500], [6, 0], [6, -1], [6, null]] loop
    begin
      perform public.reserve_try_request(h, caps[1], caps[2]);
      raise exception 'bad caps % were accepted', caps using errcode = 'P0001';
    exception when sqlstate '22023' then
      null;
    end;
  end loop;
end;
$$;
rollback;

-- 4. Isolation: under repeatable read the counts would come from a snapshot taken before the lock.
begin isolation level repeatable read;
set local role service_role;
do $$
begin
  perform public.reserve_try_request(md5(random()::text || clock_timestamp()::text), 6, 1000000000);
  raise exception 'repeatable read was accepted' using errcode = 'P0001';
exception when sqlstate '25000' then
  null;
end;
$$;
rollback;
