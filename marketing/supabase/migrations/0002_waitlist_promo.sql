-- Adds promo code support to the waitlist. Additive only — no columns are dropped
-- or altered destructively. Lets a waitlist signup carry the "UnvibeSpecial" promo
-- code and be recorded as having Pro unlocked free for a set number of months.

alter table public.waitlist_entries
  add column if not exists promo_code text,
  add column if not exists pro_granted boolean not null default false,
  add column if not exists pro_months integer,
  add column if not exists pro_expires_at timestamptz;

create index if not exists waitlist_entries_pro_granted_idx
  on public.waitlist_entries (pro_granted)
  where pro_granted;
