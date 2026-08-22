# Production integrations

The product paths are already split by responsibility:

| Provider | Use | Configuration |
| --- | --- | --- |
| PostHog | Waitlist → beta-download funnel, feature usage, flags | `POSTHOG_API_KEY`, `POSTHOG_HOST`; browser capture uses `NEXT_PUBLIC_POSTHOG_KEY` |
| Sentry | API/webhook exceptions and Electron crash reporting | `SENTRY_DSN` on web; `UNVIBE_SENTRY_DSN` for the desktop build |
| Stripe | Pro and Teams Checkout, portal, invoices, failed-payment grace period | `STRIPE_SECRET_KEY`, webhook secret, four price IDs |
| Resend | Waitlist/beta invites and founder alerts | `RESEND_API_KEY`, verified `WAITLIST_FROM_EMAIL` |
| Linear | Optional issue creation from failed webhooks | `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, `LINEAR_AUTO_CREATE_ISSUES=true` |
| Supabase | Auth, users, subscriptions, learning sync, waitlist/referrals | existing `SUPABASE_URL` + service-role key and migrations |

## Pricing decisions now encoded

- Teams is enabled automatically only when both Teams Stripe price IDs are present.
- Teams is `$8/seat/month` or `$72/seat/year`, with a hard minimum of 2 seats and a maximum of 500.
- Enterprise is not a public Stripe plan. Keep it as Contact Sales and route inquiries to `preston@unvibe.site` until a contract, provisioning, and invoicing workflow exist.

## Safe rollout order

1. Create Stripe Pro and Teams recurring prices in **test mode**, then set the four price IDs in Vercel.
2. Configure the Stripe webhook for `checkout.session.completed`, subscription create/update/delete, `invoice.paid`, and `invoice.payment_failed`.
3. Run `web` tests and a test-mode Checkout + Portal + webhook cycle.
4. Add PostHog, Sentry, Resend, and Linear keys. Leave Linear auto-create off until the team and labels are verified.
5. Repeat in live mode, then set `APP_ENV=production` and verify Supabase is configured; production refuses MemoryStore.

No provider key is bundled into Electron or sent to the browser.
