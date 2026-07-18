# Free, Pro, and Teams billing operations

This document describes the implemented engineering behavior. It is not legal approval and it
does not activate production billing.

## Product configuration

`web/src/billing/plans.ts` is the application-level source for plan limits and display math. The
`plan_entitlements` database table is the persistent, editable source used by atomic Supabase
usage reservations; the migration seeds it to the same initial values:

- Free: $0; 50 AI explanations/month; 1 active project; 25 dictionary items; 20 saved items.
- Pro: $8/month or $72/year (about $6/month, 25% annual savings); 100 AI explanations/month; up to 10 active projects.
- Teams checkout is paused (`TEAMS_CHECKOUT_ENABLED = false` in `web/src/billing/plans.ts`). Product surfaces offer Free and Pro only. Backend Teams plan math remains for any existing workspace support.

The server always chooses a trusted Stripe price ID. Browser-supplied amounts, price IDs,
customer IDs, subscription IDs, and entitlements are ignored. The database also rejects Pro on
a team workspace, Teams on a personal workspace, one-seat Teams, and multi-seat Pro.

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

1. Create two recurring Stripe Prices in test mode: Pro monthly ($8) and Pro annual ($72).
2. Set the server-only values in `web/.env.example`: secret key, webhook secret, and both Pro
   price IDs. Set `PUBLIC_APP_URL` to the dashboard HTTPS origin outside local development.
3. Register `POST /api/v1/billing/webhook` and subscribe to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`, and `invoice.paid`.
4. Keep the Customer Portal configured for payment-method updates and cancellation. Do not enable
   customer-controlled quantities unless its minimums can match the server rules.
5. Exercise the staging matrix below with Stripe test clocks/cards. Production keys and live-mode
   Prices require a separate founder release decision.

Checkout redirects do not grant access. The webhook is authoritative; the success-page refresh
only accelerates state by retrieving the Checkout Session and Subscription directly from Stripe.
Webhook claims are idempotent, completed events cannot replay, and failed processing can retry.

## Lifecycle behavior

- Invoice failure enters a configurable grace period (7 days by default). After grace expires,
  effective entitlements fall back to Free while saved content remains.
- Cancellation at period end is displayed from Stripe state. A deleted subscription becomes
  canceled and paid entitlements fall back to Free.
- Teams invitations reserve purchased seats. An invitation is accepted only by the invited email.
  Seat reductions cannot go below two or below occupied plus unexpired pending seats.
- Team owners manage billing and roles; admins manage invitations/members but not billing; members
  consume shared workspace entitlements.
- Account deletion is blocked while the owner has an active provider subscription, avoiding an
  orphaned charge. The user must cancel it first.

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
- Published totals: $8/mo Pro, $72/yr Pro (25% annual savings). Legacy Teams seat math remains in tests.

## Known launch boundary

The code is production-oriented but provider integration remains unverified until Stripe test-mode
credentials, a migrated Supabase staging project, and signed webhook deliveries are exercised.
No production billing, real charge, live Price, or legal approval is created by this change.
