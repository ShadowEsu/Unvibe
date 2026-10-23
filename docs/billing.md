# Free, Pro, and Teams billing operations

This document describes the implemented engineering behavior. It is not legal approval and it
does not activate production billing.

## Product configuration

`web/src/billing/plans.ts` is the application-level source for plan limits and display math. The
`plan_entitlements` database table is the persistent, editable source used by atomic Supabase
usage reservations; the migration seeds it to the same initial values:

- Free: $0; 50 AI explanations/month; 1 active project; 25 dictionary items; 20 saved items.
- Pro: $9/month or $81/year (about $6.75/month, 25% annual savings); 100 AI explanations/month; up to 10 active projects.
- Pro Lifetime: $80 one-time (`PRO_LIFETIME_CENTS`), offered only while checkout is open, `STRIPE_PRICE_PRO_LIFETIME` is set and `BILLING_LIFETIME_ENABLED=true`.
- Teams ($8/seat/month or $72/seat/year) is sold as a pilot by email: the site collects company email + seat request (mailto). Teams checkout has no separate switch: `teamsCheckoutEnabled()` in `web/src/billing/plans.ts` opens it as soon as both `STRIPE_PRICE_TEAMS_MONTHLY` and `STRIPE_PRICE_TEAMS_ANNUAL` are set, so leave those two unset until the site sells Teams by checkout. Backend Teams plan math remains for any existing workspace support.
- Checkout gate (`paymentsLocked()` in `web/src/billing/stripe.ts`): a live key opens checkout only on the production deployment with `BILLING_LIVE_PAYMENTS_APPROVED` set to exactly `true`; a test key is closed on production unless `BILLING_TEST_CHECKOUT_IN_PRODUCTION=true`.
- Founding Teams collab (no Stripe required): create team workspace, invite seats, shared activity feed with authorship (`GET /api/v1/workspaces/:id/history`). Explanation/code bodies stay on-device. GitHub intelligence remains out of scope.
- Founder env paste list: `docs/release/founder-paste-list.md`.

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

1. Create two recurring Stripe Prices in test mode: Pro monthly ($9) and Pro annual ($81).
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
   Prices require a separate founder release decision.

Checkout redirects do not grant access. The webhook is authoritative; the success-page refresh
waits for the completed checkout intent and paid entitlement written by the signed webhook.
Webhook claims are idempotent, completed events cannot replay, and failed processing can retry.

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
- Published totals: $9/mo Pro, $81/yr Pro (25% annual savings), $80 Pro Lifetime. Legacy Teams seat math remains in tests.

## Known launch boundary

The code is production-oriented but provider integration remains unverified until Stripe test-mode
credentials, a migrated Supabase staging project, and signed webhook deliveries are exercised.
No production billing, real charge, live Price, or legal approval is created by this change.
