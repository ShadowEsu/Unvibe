-- window_shown: one more app-reported activation kind (BOSS counter fix, ledger 620; Marketing
-- why-no-customers §10 C). The app sends it once through POST /api/v1/trial/progress when its first
-- main window has stayed visible for 3 seconds, from sealed trial builds whether or not "Send setup
-- progress" is on. It carries only the step name and the install ID the launch usage check already
-- sends. It tells an install a person saw apart from a launch-only run (the post-upload link checker,
-- or a window that opened hidden). Same retention as the other app-reported kinds (180 days).
--
-- Roll back: re-add the constraint without 'window_shown' (rows with that kind must be deleted first).

begin;

alter table public.trial_activation drop constraint if exists trial_activation_kind_check;
alter table public.trial_activation add constraint trial_activation_kind_check
  check (kind in (
    'sample', 'code',
    'onboarded', 'accessibility', 'signed_in', 'return',
    'accessibility_asked', 'level_answered', 'login_prompt_shown', 'login_prompt_accepted',
    'window_shown'
  ));

commit;
