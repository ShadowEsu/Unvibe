# Founder paste list — turn on charging

Everything in code is ready. Checkout stays **off** until you paste these into
Vercel / Stripe / Supabase. Do **not** commit secrets or paste them into chat
logs that get committed.

After you reply with the values (or confirm they are set in the dashboards),
the next step is: create Stripe prices → set env → register webhook → apply
migration → test checkout → flip live.

## A. Stripe (required to charge)

Create products/prices in Stripe Dashboard (test mode first):

| Product | Amount | Mode | Env var to paste |
| --- | --- | --- | --- |
| Pro monthly | **$10 / month** | recurring | `STRIPE_PRICE_PRO_MONTHLY` = `price_...` |
| Pro annual | **$90 / year** | recurring | `STRIPE_PRICE_PRO_ANNUAL` = `price_...` |
| Pro Lifetime | **$80 once** | one-time | `STRIPE_PRICE_PRO_LIFETIME` = `price_...` |

Also paste:

```
STRIPE_SECRET_KEY=sk_test_...   # then sk_live_... only after test checkout works
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_APP_URL=https://api.unvibe.site
```

Webhook endpoint (Stripe → Developers → Webhooks):

```
https://api.unvibe.site/api/v1/billing/webhook
```

Events: `checkout.session.completed`, `customer.subscription.*`,
`invoice.paid`, `invoice.payment_failed` (match whatever `web/src/billing/webhooks.ts` handles).

Where: Vercel project for **`unvibe-api`** / `web` (the API the desktop app hits).

## B. AI + database (required for real product)

```
OPENROUTER_API_KEY=...
ENABLE_MOCK_AI=false
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_PROJECT_ID=...
APP_ENV=production
WEB_BASE_URL=https://api.unvibe.site
```

Apply migration on that Supabase project (includes lifetime interval):

`web/supabase/migrations/20260908120000_lifetime_interval.sql`
(and any earlier billing migrations not yet applied).

## C. Support / company email (already wired in UI)

App + web Plan pages open mail to:

```
preston@unvibe.site
```

for **Teams seats** (company email + seat count) and Enterprise. If you want a
dedicated inbox instead, say the address and we swap it once:

```
SUPPORT_EMAIL=support@unvibe.site   # tell me if different
```

Marketing already uses `preston@unvibe.site` / `support@unvibe.site` in places.

## D. Teams / seats (collab ready without Stripe)

Self-serve Teams **checkout** is still paused. Collab works anyway:

- Create team workspace + invite (app Team page / web Plan)
- Shared who-reviewed-what activity feed
- Apply migration `20260909093000_teams_collab_history.sql`

When you are ready to charge Teams:

```
STRIPE_PRICE_TEAMS_MONTHLY=price_...   # $8/seat/month
STRIPE_PRICE_TEAMS_ANNUAL=price_...    # optional
```

Then flip `TEAMS_CHECKOUT_ENABLED` to `true` in `web/src/billing/plans.ts`
(code change + deploy — ask for that when Stripe Teams prices exist).

## E. GitHub (releases / install, not billing)

For install links and Windows/Mac artifacts:

- Repo releases stay public (current install scripts point at GitHub releases).
- Optional: GitHub App / OAuth later for **Teams GitHub intelligence** — not
  required to charge Pro/Lifetime today. Paste only if you want that next:

```
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

## F. Marketing waitlist (if not already set)

On the marketing Vercel project:

```
WAITLIST_NOTIFY_EMAIL=preston@unvibe.site
RESEND_API_KEY=...
WAITLIST_FROM_EMAIL=Unvibe Waitlist <waitlist@unvibe.site>
BLOB_READ_WRITE_TOKEN=...
WAITLIST_ADMIN_TOKEN=...
```

## What you send me next (copy this block)

Paste only the blanks you have. Test-mode Stripe is fine first.

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_ANNUAL=
STRIPE_PRICE_PRO_LIFETIME=
OPENROUTER_API_KEY= (or confirm already on Vercel)
SUPABASE_URL= (or confirm project ref)
SUPPORT_EMAIL= preston@unvibe.site (or change)
Teams company interest: (optional — seat count / company domain)
GitHub App: skip for now / here are keys
```

I will not put these in the repo. I will set them on Vercel (if you give access)
or walk you through the dashboard clicks, run one test checkout, then live.
