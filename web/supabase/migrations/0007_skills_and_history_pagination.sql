-- Persist cautious, evidence-based concept summaries and provide stable server-side history
-- pagination. The skills table remains an internal beta model until this migration is
-- verified in staging.
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  normalized_name text not null,
  display_name text not null,
  category text,
  language text,
  framework text,
  first_encountered_at timestamptz not null,
  last_encountered_at timestamptz not null,
  last_reviewed_at timestamptz not null,
  encounter_count integer not null check (encounter_count >= 0),
  review_count integer not null check (review_count >= 0),
  successful_checks integer not null check (successful_checks >= 0),
  unsuccessful_checks integer not null check (unsuccessful_checks >= 0),
  evidence_state text not null check (evidence_state in ('seen', 'familiar', 'strong', 'needs_review')),
  next_review_date date,
  related_projects text[] not null default '{}',
  related_event_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create index if not exists skills_user_last_seen_idx on skills(user_id, last_encountered_at desc);
alter table skills enable row level security;

create policy "skills self read" on skills
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table skills from anon, authenticated;
grant select on table skills to authenticated;

create or replace function rebuild_user_skills(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  with concept_events as (
    select
      lower(trim(coalesce(nullif(concept_label, ''), concept))) as normalized_name,
      coalesce(nullif(concept_label, ''), concept) as display_name,
      language,
      id,
      ts,
      outcome,
      project,
      row_number() over (
        partition by lower(trim(coalesce(nullif(concept_label, ''), concept)))
        order by ts desc, id desc
      ) as latest_rank
    from public.events
    where user_id = p_user_id and coalesce(nullif(concept_label, ''), concept) is not null
  ), aggregates as (
    select
      normalized_name,
      max(display_name) filter (where latest_rank = 1) as display_name,
      max(language) filter (where latest_rank = 1) as language,
      min(ts) as first_encountered_at,
      max(ts) as last_encountered_at,
      count(*)::integer as encounter_count,
      count(*)::integer as review_count,
      count(*) filter (where outcome = 'understood')::integer as successful_checks,
      count(*) filter (where outcome = 'needs_review')::integer as unsuccessful_checks,
      max(outcome) filter (where latest_rank = 1) as latest_outcome,
      array_agg(id order by ts, id) as related_event_ids,
      coalesce(array_agg(distinct project) filter (where project is not null), '{}') as related_projects
    from concept_events
    group by normalized_name
  )
  insert into public.skills (
    user_id, normalized_name, display_name, category, language,
    first_encountered_at, last_encountered_at, last_reviewed_at,
    encounter_count, review_count, successful_checks, unsuccessful_checks,
    evidence_state, next_review_date, related_projects, related_event_ids, updated_at
  )
  select
    p_user_id, normalized_name, display_name, language, language,
    first_encountered_at, last_encountered_at, last_encountered_at,
    encounter_count, review_count, successful_checks, unsuccessful_checks,
    case
      when latest_outcome = 'needs_review' then 'needs_review'
      when successful_checks >= 3 then 'strong'
      when successful_checks >= 2 then 'familiar'
      else 'seen'
    end,
    case when successful_checks >= 3 and latest_outcome <> 'needs_review'
      then null else last_encountered_at::date end,
    related_projects, related_event_ids, now()
  from aggregates
  on conflict (user_id, normalized_name) do update set
    display_name = excluded.display_name,
    category = excluded.category,
    language = excluded.language,
    first_encountered_at = excluded.first_encountered_at,
    last_encountered_at = excluded.last_encountered_at,
    last_reviewed_at = excluded.last_reviewed_at,
    encounter_count = excluded.encounter_count,
    review_count = excluded.review_count,
    successful_checks = excluded.successful_checks,
    unsuccessful_checks = excluded.unsuccessful_checks,
    evidence_state = excluded.evidence_state,
    next_review_date = excluded.next_review_date,
    related_projects = excluded.related_projects,
    related_event_ids = excluded.related_event_ids,
    updated_at = now();

  delete from public.skills s
  where s.user_id = p_user_id
    and not exists (
      select 1 from public.events e
      where e.user_id = p_user_id
        and lower(trim(coalesce(nullif(e.concept_label, ''), e.concept))) = s.normalized_name
    );
end;
$$;

create or replace function history_page(
  p_user_id uuid,
  p_limit integer,
  p_cursor_ts timestamptz default null,
  p_cursor_id text default null
) returns setof public.events
language sql
stable
security invoker
set search_path = ''
as $$
  select e.*
  from public.events e
  where e.user_id = p_user_id
    and (
      p_cursor_ts is null
      or e.ts < p_cursor_ts
      or (e.ts = p_cursor_ts and e.id < p_cursor_id)
    )
  order by e.ts desc, e.id desc
  limit greatest(1, least(p_limit, 500));
$$;

revoke all on function rebuild_user_skills(uuid) from public, anon, authenticated;
revoke all on function history_page(uuid, integer, timestamptz, text) from public, anon, authenticated;
grant execute on function rebuild_user_skills(uuid) to service_role;
grant execute on function history_page(uuid, integer, timestamptz, text) to service_role;
