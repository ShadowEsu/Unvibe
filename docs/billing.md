# Free, Pro, Enterprise, Big Business and Teams billing operations

This document describes the implemented engineering behavior. It is not legal approval and it
does not activate production billing.

## Product configuration

`web/src/billing/plans.ts` is the application-level source for plan limits and display math. The
`plan_entitlements` database table is the persistent, editable source used by atomic Supabase
usage reservations; the migration seeds it to the same initial values:

- Free: $0; 50 AI explanations/month; 1 active project; 25 dictionary items; 20 saved items. Every new signed-in account still gets its first month on Pro (the `on_app_account` welcome month, unchanged).
- Pro: $9/month or $81/year (about $6.75/month, 25% annual savings); 200 AI explanations/month (was 100; the database row changes when `20261031090000_enterprise_business_tiers.sql` is applied, which needs the owner's yes because it reaches every existing Pro row at once); up to 10 active projects.
- Enterprise: $50/month (`ENTERPRISE_MONTHLY_CENTS`), monthly only, one account (personal workspace, one seat); 1,000 explanations, 2,500 questions, 25 projects, 5,000 dictionary and 5,000 saved items a month; every Pro feature. Stripe price `STRIPE_PRICE_ENTERPRISE_MONTHLY`.
- Big Business: $5,000 one-time (`BUSINESS_ONE_TIME_CENTS`), stored as interval `lifetime` with period end 2099-12-31 and the PaymentIntent id, exactly like Pro Lifetime (paid sessions only, trusted line-item price; a full refund or a lost dispute revokes it). One account. The site states the real cap, "5,000 explanations a month (fair use)", under a written fair-use limit: 5,000 explanations and 10,000 questions a month (also 100 projects, 20,000 dictionary and 20,000 saved items), enforced like any cap, no hidden throttling. These numbers are a placeholder pending the owner's choice; they live only in `BILLING_LIMITS` (`web/src/billing/plans.ts`) and the migration (the site copies them in `marketing/src/lib/pricing.ts`). Stripe price `STRIPE_PRICE_BUSINESS_LIFETIME`.
- Enterprise and Big Business are sold only while `BILLING_NEW_TIERS_ENABLED` is exactly `true` (`newTiersEnabled()`), on top of the payment locks below. Off (the default, and production): checkout answers 400 `plan_unavailable` for `enterprise`/`business`, and the webhook never grants either (it can still revoke one already on record). The site and the Plan pages show both as "Payments open soon" with an apply-by-email link and no Buy button, whatever the flag, until live payments are cleared.
- Runbook, before ever turning `BILLING_NEW_TIERS_ENABLED` off: first expire every open Enterprise and Big Business Checkout Session (a session lives about 31 minutes and can still be paid after the switch), then switch it off. Every `checkout.refused_plan_unavailable` or `subscription.refused_plan_unavailable` audit row afterwards is a payment taken with nothing granted: refund it, and cancel the Enterprise subscription, within one business day.
- Deploy order: apply `20261031090000_enterprise_business_tiers.sql` and `20261031091000_subscriptions_stripe_event_at.sql`, then merge. The server writes `subscriptions.stripe_event_at` on every Stripe subscription write, Pro included, so code deployed before that column exists fails every such write. `web/test/newTiers.test.ts` fails if the store writes the column while its migration is missing. Rollback of the column (after rolling the code back): `alter table public.subscriptions drop column if exists stripe_event_at;`.
- Then apply `20261101090000_atomic_subscription_writes.sql` before deploying the code that calls its two functions: every subscription write and cancel goes through `sync_subscription_if_not_older` and `cancel_subscription_by_provider_id` (service role only), so code deployed before them fails every such write, Pro included. Rollback (after rolling the code back) is the three `drop ... if exists` lines in its header; roll back in reverse order, this migration before the column.
- Pro Lifetime: $80 one-time (`PRO_LIFETIME_CENTS`), offered only while checkout is open, `STRIPE_PRICE_PRO_LIFETIME` is set and `BILLING_LIFETIME_ENABLED=true`.
- Teams ($8/seat/month or $72/seat/year) is no longer offered: the site, the web Plan page and the app have no Teams purchase or seat-request path, and existing Teams workspaces keep their seats and Manage billing. Teams checkout has no separate switch: `teamsCheckoutEnabled()` in `web/src/billing/plans.ts` opens it as soon as both `STRIPE_PRICE_TEAMS_MONTHLY` and `STRIPE_PRICE_TEAMS_ANNUAL` are set, so leave those two unset until the site sells Teams by checkout. Backend Teams plan math remains for any existing workspace support.
- Checkout gate (`paymentsLocked()` in `web/src/billing/stripe.ts`): a live key opens checkout only on the production deployment with `BILLING_LIVE_PAYMENTS_APPROVED` set to exactly `true`; a test key is closed on production unless `BILLING_TEST_CHECKOUT_IN_PRODUCTION=true`.
- Founding Teams collab (no Stripe required): team workspaces (API only; no Create team control on the web Plan page since 7f43af6), invite seats, shared activity feed with authorship (`GET /api/v1/workspaces/:id/history`). Explanation/code bodies stay on-device. GitHub intelligence remains out of scope.
- Owner env paste list: `docs/release/owner-paste-list.md`.

The server always chooses a trusted Stripe price ID. Browser-supplied amounts, price IDs,
customer IDs, subscription IDs, and entitlements are ignored. The database also rejects Pro on
a team workspace, Teams on a personal workspace, one-seat Teams, and multi-seat Pro, Enterprise or Big Business;
Enterprise is monthly only and Big Business is `lifetime` only.

QA usage seed (memory store only): `UNVIBE_TEST_USAGE_SEED=<plan>:<used>` (`free`, `pro`, `enterprise` or
`business`, for example `pro:199` or `enterprise:999`) makes every personal workspace the memory billing
store creates start on that plan with that many explanations already used this month. It throws when the
store starts with `VERCEL_ENV=production` or with any `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. The
memory store runs when no Supabase variables are set (`next dev`); under `NODE_ENV=production` it also
needs `UNCODE_ALLOW_MEMORY_STORE=true`.

## Data model and migration

Apply `web/supabase/migrations/20260716092442_plans_workspaces_billing.sql` after migrations
0001–0007. It is additive. Every existing user receives one personal workspace and a Free
subscription record; existing events, skills, and consent records are associated with that
workspace without changing their identifiers.

New tables store workspaces, memberships, invitations, subscriptions, checkout intents, monthly
usage counters, usage events, webhook claims, and billing audit records. All are RLS-enabled.
Browser roles have no table privileges; the server service role has explicit grants. RPC execute
privileges are also restricted to `service_role`.

## Stripe test-mode setup

1. Create two recurring Stripe Prices in test mode: Pro monthly ($9) and Pro annual ($81). For the new tiers (test mode only, with
   `BILLING_NEW_TIERS_ENABLED=true`): Enterprise monthly ($50, recurring) and Big Business ($5,000, one-time).
2. Set the server-only values in `web/.env.example`: secret key, webhook secret, and both Pro
   price IDs. Set `PUBLIC_APP_URL` to the dashboard HTTPS origin outside local development.
3. Register `POST /api/v1/billing/webhook` and subscribe to:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`, `invoice.paid`, `charge.refunded`, `charge.dispute.created`, and
   `charge.dispute.closed`. The same list goes on the live endpoint.
4. Keep the Customer Portal configured for payment-method updates and cancellation. Do not enable
   customer-controlled quantities unless its minimums can match the server rules.
5. Exercise the staging matrix below with Stripe test clocks/cards. Production keys and live-mode
   Prices require a separate owner release decision.

Checkout redirects do not grant access. The webhook is authoritative; the success-page refresh
waits for the completed checkout intent and paid entitlement written by the signed webhook.
Webhook claims are idempotent, completed events cannot replay, and failed processing can retry.
Grants are refund-aware and ordered. Before any grant (a Lifetime or Big Business checkout, or a
subscription moving into paid access), the webhook refuses, with a `checkout.refused_payment` or
`subscription.refused_payment` audit row, a payment with a recorded full refund (`charge.refunded`
records its PaymentIntent even when nothing matched yet) or one that Stripe reports (PaymentIntent
with `latest_charge`) as not succeeded, refunded in whole or part, or disputed. A one-time payment
whose row a refund or lost dispute already canceled is never granted again. Each subscription row
keeps the Stripe `created` time of the last event applied (`stripe_event_at`), and an older event
for the same subscription or payment changes nothing, so a retried or late checkout event cannot
restore access a newer refund took away. The comparison is part of the write
(`sync_subscription_if_not_older`: one `insert ... on conflict do update ... where`), so two deliveries
of the same subscription processed at once cannot let an older event overwrite a newer one either; a
cancel always applies and never moves `stripe_event_at` back (`cancel_subscription_by_provider_id`). After a Lifetime or
Big Business grant writes its row, the payment is checked again (recorded refunds, then Stripe), so a
refund or dispute handled while the grant was in flight still ends access; a failure of that check
fails the event, and its retry takes the row back if the payment is refused by then. A paid checkout
session without a PaymentIntent grants nothing (`checkout.refused_payment`, reason `no_payment_intent`).

After every subscription write that grants access, the webhook also re-reads the subscription from
Stripe. If it ended (or no longer exists), the row is canceled; a non-entitling state or failed
payment applies the revoke-only downgrade/grace rules. This closes the window where a `deleted`
arrived before there was a row for that subscription and so canceled nothing. After a subscription
first grants access, its payments are checked again too: a refusal cancels the Stripe subscription
with `uncode-revoke-<subscription id>`, then cancels the row. If the Stripe cancel fails, the event
fails and its retry checks the payment and retries that same cancellation key, even though the row
has already been written. Stripe is canceled first so a failed attempt cannot leave a subscription
charging while a canceled local row causes its retry to skip the payment check.

The `refund.full` rows in `billing_audit_log` are security state, not just history: they are what
refuses a grant of a payment whose refund arrived before (or during) its checkout event. Never prune,
archive or rewrite them. The lookup (`action = 'refund.full'` and `metadata->>'paymentIntentId'`)
uses `billing_audit_refund_payment_intent_idx`.

## Lifecycle behavior

- Invoice failure enters a configurable grace period (7 days by default). After grace expires,
  effective entitlements fall back to Free while saved content remains.
- Cancellation at period end is displayed from Stripe state. A deleted subscription becomes
  canceled and paid entitlements fall back to Free.
- **A full refund of the current period's invoice ends access at once.** When `charge.refunded`
  covers the whole charge and that charge paid the invoice for the subscription's current period
  (`billing_reason` `subscription_create` or `subscription_cycle`, line period starting at the live
  subscription's current period), the subscription is canceled at Stripe immediately and the
  account drops to Free. A full Lifetime refund revokes Lifetime. Support: refunding this month
  means "cancel now"; to refund but keep access, refund partially.
- Everything else keeps access and is only audited: partial refunds, prorations
  (`subscription_update`), invoices for an earlier period, and charges that can't be linked to an
  invoice (matched only by customer). The charge is linked through Stripe Invoice Payments (API
  dahlia has no `charge.invoice`). Every refund writes `refund.full` / `refund.partial` with
  `revoked` and `matchedBy`.
- A dispute does not change access while it is open (`dispute.opened` audit row with the evidence
  deadline; `/api/v1/admin/stats` reports `disputesOpen` and `disputeNextDueBy`). A lost dispute
  on an invoice or Lifetime payment ends access, whatever period it paid for; a won one keeps it.
- Teams invitations reserve purchased seats. An invitation is accepted only by the invited email.
  Seat reductions cannot go below two or below occupied plus unexpired pending seats.
- Team owners manage billing and roles; admins manage invitations/members but not billing; members
  consume shared workspace entitlements.
- Account deletion is blocked while the owner has an active provider subscription, avoiding an
  orphaned charge. The user must cancel it first.

## Promo codes (complimentary Pro without Stripe)

- A batch (`promo_batches`) sets the months per code (1 to 12), a redeem-by time and a cap on
  redemptions. Codes are 16 Crockford base32 characters (80 random bits), shown
  `XXXX-XXXX-XXXX-XXXX`; the database stores only `sha256("unvibe-promo:" + code)`. Migration
  `web/supabase/migrations/20261026090000_promo_codes.sql`.
- Redeeming goes through `add_pro_months`, like gifts and the welcome month: 30-day months stacked
  on running complimentary Pro, at most 12 months ahead, never on a live Stripe subscription (then
  the code is not used up). One code per account per batch; each code once.
- People redeem at `unvibe.site/redeem` (a link can prefill the code: `/redeem?promo=XXXX-XXXX-XXXX-XXXX`;
  `?code=` belongs to Supabase sign-in). Supabase sign-in, then `/api/redeem`, which forwards to
  `POST /api/v1/promo/redeem`. The API answers 200 `redeemed`/`already_yours`, 400 `bad_code`, 401,
  404 `invalid` (unknown or revoked, same answer), 409 `used`/`one_per_account`/`has_paid_plan`, 410
  `expired`/`cap_reached`, 429, 503.
- No minting over the API. `web/scripts/promo-batch.mjs generate <batch> <count>` writes the codes to
  a private CSV (mode 600, `~/.config/unvibe-promo/unvibe-promo-<batch>.csv`) and a hash-only SQL
  insert that is run once by hand. `take <batch> <who>` hands out the next code under a file lock.
  `generate`, `take` and `verify` all refuse a folder that isn't yours, that other users can write
  (group or world), or that sits under a folder they can change. A sticky parent like `/tmp` is
  allowed, because other users can't rename or delete what is yours there. They also refuse a folder
  path that is itself a symlink; pass the real folder path instead. `generate` refuses a `--label`
  with control characters (tabs, line breaks and the like, and invisible ones such as zero-width
  spaces and text-direction marks). It prints the SQL's sha256: record it somewhere off this Mac,
  for example in a note on your phone, because anyone who could change the SQL here could change a
  copy kept next to it. The verify command it prints has a placeholder where the sha256 goes, so a
  copy from the Terminal history never carries it. Right before the SQL runs on production, run
  `verify <batch> --expect-sha <sha256>` with the sha256 you recorded. It refuses to go on without
  it, and refuses an SQL or CSV that is a symlink, has a second hard link, belongs to another user
  or can be written by other users. It refuses the SQL (do not run it) if the file's sha256 is
  different. Then it checks that the SQL is exactly the insert for the codes in the CSV, refuses a
  label with control characters, and prints the batch settings. Run that verified file itself, for
  example `psql -f <sql>`. Never paste it into an SQL editor: a pasted copy is not what the hash
  covered.
- `GET /api/v1/admin/promo` lists batches and redemptions; `POST` with `revoke_code` or
  `revoke_batch` switches codes off (`UNVIBE_ADMIN_STATS_TOKEN`; the script's `list` and `revoke`
  use it). Revoking a redeemed code takes back only the promo time not used yet: at most what that
  redemption added (stored as `granted`, after the 12-month ceiling), only the part still ahead of
  now, and never on a live Stripe subscription. Used-up promo days and later Pro time (gift, welcome
  months) stay. Revoking a batch stops new redemptions and leaves granted months
  alone. Deleting an account keeps its redemption row (no user link, no email), so the code stays
  used and counts against the cap.

## Credential-free verification

Run:

```sh
cd web && npm test && npm run typecheck && npm run build
cd ../marketing && npm test && npm run typecheck && npm run build
cd ../app && npm test && npm run typecheck && npm run build
```

Then verify with test credentials:

- Free → Pro monthly and annual; Free/Pro → Teams at 2 and 5 seats.
- Reject Teams at 0 or 1 seat, occupied-seat reductions, wrong price IDs, and replayed webhooks.
- Successful, failed, past-due/grace, renewed, cancel-at-period-end, deleted, and reactivated states.
- Invitation acceptance with the right/wrong email; owner/admin/member permission boundaries.
- User A cannot read or mutate User B workspaces using staging isolation scripts.
- Published totals: $9/mo Pro, $81/yr Pro (25% annual savings), $80 Pro Lifetime, $50/mo Enterprise, $5,000 Big Business. Legacy Teams seat math remains in tests.
- New tiers: flag exactness, checkout refusal and webhook non-grant with the flag off, price/metadata mismatches, Big Business refund and dispute revocation, refunds and cancels racing a grant (forced interleavings), and the route's PaymentIntent read (`web/test/newTiers.test.ts`, `web/test/webhookRoute.test.ts`); the QA usage seed (`web/test/usageSeed.test.ts`).

## Known launch boundary

The code is production-oriented but provider integration remains unverified until Stripe test-mode
credentials, a migrated Supabase staging project, and signed webhook deliveries are exercised.
No production billing, real charge, live Price, or legal approval is created by this change.
