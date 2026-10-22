-- One open Teams checkout per owner, across all of their team workspaces. The checkout route
-- checks this before inserting, but two parallel requests (double click, two tabs) could both
-- pass the check and open two payable Stripe sessions. The partial unique index makes the second
-- insert fail with 23505, which the API answers as 409 checkout_pending.
-- Same shape as the existing checkout_intents_one_pending_workspace_idx (one pending per workspace).
-- Keep web/src/billing/memoryBillingStore.ts createCheckoutIntent in lockstep.

-- Existing duplicates would block the index: keep each owner's newest pending Teams intent and
-- expire older ones. Expired only changes how the app treats the intent; a session already paid
-- is still matched by its Stripe session id when the webhook completes it.
with ranked as (
  select id, row_number() over (partition by user_id order by created_at desc, id desc) as rn
  from public.checkout_intents
  where status = 'pending' and plan = 'teams'
)
update public.checkout_intents c
set status = 'expired'
from ranked r
where c.id = r.id and r.rn > 1;

create unique index if not exists checkout_intents_one_pending_teams_owner_idx
  on public.checkout_intents (user_id)
  where status = 'pending' and plan = 'teams';

-- Rollback:
--   drop index if exists public.checkout_intents_one_pending_teams_owner_idx;
-- (Intents expired above stay expired; they were older open checkouts for the same owner.)
