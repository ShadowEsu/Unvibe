-- window_shown: one more app-reported activation kind (BOSS counter fix, ledger 620; Marketing
-- why-no-customers §10 C). The app sends it once through POST /api/v1/trial/progress when its first
-- main window has stayed visible for 3 seconds, from sealed trial builds whether or not "Send setup
-- progress" is on. Like every step it carries the step name with the random install ID, the system and
-- the app version the launch usage check already sends; the server keeps only (install_key, kind, at).
-- It helps tell an install a person opened apart from a launch-only run (the post-upload link checker,
-- or a window that opened hidden). Same retention as the other app-reported kinds (180 days).
--
-- Roll back: re-add the constraint without 'window_shown' (rows with that kind must be deleted first).

begin;

-- Exactly one kind check, named trial_activation_kind_check (as 20261025120000 left it); anything else
-- stops the transaction so an old check under another name cannot survive next to the new one.
do $$
begin
  if (select count(*) from pg_constraint
      where conrelid = 'public.trial_activation'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) like '%kind%') <> 1
     or not exists (select 1 from pg_constraint
      where conrelid = 'public.trial_activation'::regclass and contype = 'c'
        and conname = 'trial_activation_kind_check') then
    raise exception 'expected exactly one kind check on public.trial_activation, named trial_activation_kind_check';
  end if;
end
$$;

alter table public.trial_activation drop constraint if exists trial_activation_kind_check;
alter table public.trial_activation add constraint trial_activation_kind_check
  check (kind in (
    'sample', 'code',
    'onboarded', 'accessibility', 'signed_in', 'return',
    'accessibility_asked', 'level_answered', 'login_prompt_shown', 'login_prompt_accepted',
    'window_shown'
  ));

commit;
