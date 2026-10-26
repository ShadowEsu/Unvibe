# Owner checklist: turn on charging

Billing code is **not** all ready. Stripe stays in test mode and checkout stays locked on
production until every step below is done and approved. Still open before anyone can be charged:

- two production database migrations: clearing an ended Stripe subscription when complimentary
  Pro is granted, and one conditional write for subscription sync;
- the cancellation policy while purchases are locked (whether the customer portal stays open
  for existing subscribers);
- a published refund policy, paid terms and terms consent at Checkout (attorney);
- the tax route (Stripe Tax or Managed Payments), chosen before the first live sale.

## Never paste secret values anywhere but the dashboard

Enter keys, webhook signing secrets, service-role keys and tokens yourself, in the hosting
dashboard's environment variables. Never paste a value into a chat, an issue, a pull request, a
commit or this file. When reporting progress, name which variables are set; never their values.

Stripe keys must be entered exactly as Stripe shows them, with no spaces or trailing newline. The
API reads a key only when it matches `^(sk|rk)_(test|live)_[0-9A-Za-z]+$`
(`web/src/billing/stripeKey.ts`); anything else counts as not configured, so checkout stays
closed and the webhook answers 503.

## A. Stripe (test mode first)

Create these prices in the Stripe Dashboard, in test mode first:

| Product | Amount | Kind | Variable | Needed |
| --- | --- | --- | --- | --- |
| Pro monthly | **$9 / month** | recurring | `STRIPE_PRICE_PRO_MONTHLY` | Yes |
| Pro annual | **$81 / year** | recurring | `STRIPE_PRICE_PRO_ANNUAL` | Yes |
| Pro Lifetime | **$80 once** | one-time | `STRIPE_PRICE_PRO_LIFETIME` | Optional, off by default |

Lifetime checkout opens only when `STRIPE_PRICE_PRO_LIFETIME` is set **and**
`BILLING_LIFETIME_ENABLED` is `true` (`lifetimeCheckoutOpen()` in `web/src/billing/stripe.ts`).
Leave both unset to keep Lifetime off.

Server variables on the API project (`web/`, the API the desktop app calls):

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | A test key (`sk_test_` or `rk_test_`) until live payments are approved. |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of the endpoint below. |
| `APP_URL` | The public origin that serves `/plan`, for Checkout and portal return links. |
| `BILLING_TEST_CHECKOUT_IN_PRODUCTION` | Leave unset on production. |
| `BILLING_LIVE_PAYMENTS_APPROVED` | Leave unset. Exactly `true` opens a live key on production; only after approval. |

Webhook endpoint (Stripe, Developers, Webhooks):

```
https://api.unvibe.site/api/v1/billing/webhook
```

Subscribe to exactly the events `web/src/billing/webhooks.ts` handles, with no wildcard:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

Customer portal: keep plan and quantity switching off. Cancellation, payment methods and invoice
history can stay on.

## B. AI and database

Production runs on Gemini:

```
GEMINI_API_KEY=<enter in the dashboard>
GEMINI_MODEL=<optional; the code default is gemini-3.1-flash-lite>
ENABLE_MOCK_AI=false
SUPABASE_URL=<enter in the dashboard>
SUPABASE_ANON_KEY=<enter in the dashboard>
SUPABASE_SERVICE_ROLE_KEY=<enter in the dashboard>
SUPABASE_PROJECT_ID=<enter in the dashboard>
APP_ENV=production
WEB_BASE_URL=https://api.unvibe.site
```

The API picks OpenRouter first, then Anthropic, then Gemini (`selectProvider` in
`web/src/ai/index.ts`), so leave `OPENROUTER_API_KEY` and `ANTHROPIC_API_KEY` unset on production.

Apply every migration in `web/supabase/migrations` that production does not have yet, only after
it has passed on a separate staging project.

## C. Support email

The app and web Plan pages send Teams seat requests and Enterprise questions to the address in
`SUPPORT_MAIL` (`web/app/plan/PlanManager.tsx`). Choose the support identity before launch; a
change is a code change.

## D. Teams

Team workspaces, invitations and the shared activity feed work without Stripe (migration
`20260909093000_teams_collab_history.sql`).

Teams checkout has no separate switch and there is no `TEAMS_CHECKOUT_ENABLED`. It opens as soon as
**both** of these are set (`teamsCheckoutEnabled()` in `web/src/billing/plans.ts`):

```
STRIPE_PRICE_TEAMS_MONTHLY=<price id>   # $8/seat/month
STRIPE_PRICE_TEAMS_ANNUAL=<price id>    # $72/seat/year
```

Leave both unset while Teams is sold by email.

## E. GitHub (releases and install, not billing)

- Repo releases stay public (the install scripts point at GitHub releases).
- A GitHub App or OAuth for Teams GitHub intelligence is optional and not needed to charge for
  Pro. If you set it up, enter these in the dashboard only:

```
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

## F. Marketing waitlist (if not already set)

On the marketing Vercel project:

```
WAITLIST_NOTIFY_EMAIL=<monitored inbox>
RESEND_API_KEY=<enter in the dashboard>
WAITLIST_FROM_EMAIL=Unvibe Waitlist <waitlist@unvibe.site>
BLOB_READ_WRITE_TOKEN=<enter in the dashboard>
WAITLIST_ADMIN_TOKEN=<enter in the dashboard>
```

## Order

1. Close the open items at the top of this page.
2. Create the test-mode prices, set the variables above in the dashboard and register the webhook
   with the exact event list.
3. Run one test checkout end to end (checkout, renewal failure, cancellation, refund) and keep the
   evidence.
4. Security review of the deployed code, then the pricing and cost sign-off.
5. Live keys, live prices and `BILLING_LIVE_PAYMENTS_APPROVED=true` only after the attorney has
   named the seller and live payments are approved.
