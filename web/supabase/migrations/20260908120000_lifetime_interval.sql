-- Allow Pro Lifetime one-time purchases to persist as interval = 'lifetime'.
-- Inline check constraints from the original billing migration use Postgres auto-names.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'subscriptions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%monthly%annual%'
      and pg_get_constraintdef(con.oid) not ilike '%lifetime%'
  loop
    execute format('alter table subscriptions drop constraint %I', constraint_name);
  end loop;

  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'checkout_intents'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%monthly%annual%'
      and pg_get_constraintdef(con.oid) not ilike '%lifetime%'
  loop
    execute format('alter table checkout_intents drop constraint %I', constraint_name);
  end loop;
end $$;

alter table subscriptions
  add constraint subscriptions_interval_values_check
  check (interval is null or interval in ('monthly', 'annual', 'lifetime'));

alter table checkout_intents
  add constraint checkout_intents_interval_values_check
  check (interval in ('monthly', 'annual', 'lifetime'));
