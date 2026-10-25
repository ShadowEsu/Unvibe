-- One-ID first-run funnel (instrumentation spec 2026-10-22, sections 4-5, plus the first-run spec
-- section 4 kinds). Nullable columns, so existing rows and older app builds stay valid.
-- trial_installs gains the OS family and the app version an install started on, set on insert only.
-- trial_activation gains more write-once markers. Each is one row (install_key, kind, at): a
-- timestamp only, never code, file names, email or IP.
--
-- The inline check from 20261018160000 gets Postgres's default name trial_activation_kind_check;
-- confirm with \d public.trial_activation before applying.
--
-- Rollback (deletes the new marker rows first, or the old check cannot be restored):
--   delete from public.trial_activation where kind not in ('sample', 'code');
--   alter table public.trial_activation drop constraint if exists trial_activation_kind_check;
--   alter table public.trial_activation add constraint trial_activation_kind_check check (kind in ('sample', 'code'));
--   alter table public.trial_installs drop column if exists first_version, drop column if exists platform;

alter table public.trial_installs
  add column if not exists platform text check (platform in ('mac', 'win')),
  add column if not exists first_version text check (first_version ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,4}$');

alter table public.trial_activation drop constraint if exists trial_activation_kind_check;
alter table public.trial_activation add constraint trial_activation_kind_check
  check (kind in (
    'sample', 'code',
    'onboarded', 'accessibility', 'signed_in', 'return',
    'accessibility_asked', 'level_answered', 'login_prompt_shown', 'login_prompt_accepted'
  ));

-- Retention (spec section 10): the app-reported kinds and `return` are deleted after 180 days by a
-- monthly manual run until a cron exists:
--   delete from public.trial_activation
--   where kind not in ('sample', 'code') and at < now() - interval '180 days';
