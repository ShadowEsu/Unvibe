# Unvibe launch configuration — values you need to supply

This is the short checklist for configuring Unvibe without putting secrets in
Git, the marketing browser bundle, or the desktop app. Fill the values in the
hosting dashboards / secret manager only. Do **not** paste them into this file,
commit them, or send them to testers.

**Turning on charging:** follow the page titled "Owner checklist: turn on charging" in `docs/release/`. Enter every value in the
hosting dashboard yourself and never paste one into a chat; report only which variables are set.
Checkout stays disabled until those env vars exist on the API and payments are approved.

## 1. Backend and desktop API (`web/`)

Set these on the deployed backend project (the service the desktop app calls,
currently intended to be `https://api.unvibe.site`).

| Variable | What to fill in | Required for public use |
| --- | --- | --- |
| `APP_ENV` | `production` only after staging has passed. | Yes |
| `WEB_BASE_URL` | The backend's public HTTPS URL, for example `https://api.unvibe.site`. | Yes |
| `APP_URL` | The trusted HTTPS return URL for Billing Checkout/Portal. Use the public web app origin that hosts `/plan`. The code reads `APP_URL` first and falls back to the old name `PUBLIC_APP_URL`; production needs one of them. | Yes for billing |
| `ENABLE_MOCK_AI` | Development only; production ignores it. | No |
| `GEMINI_API_KEY` | Production AI key: every AI route uses only Google Gemini (`selectProvider` in `web/src/ai/index.ts`), as the consent screen and privacy policy say. Start with a restricted key and a spend limit. | Yes |
| `GEMINI_MODEL` | The approved Gemini model name (default `gemini-3.1-flash-lite`). | Recommended |
| `SUPABASE_URL` | Your production Supabase project URL. | Yes |
| `SUPABASE_ANON_KEY` | The Supabase publishable/anon key. | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | The server-only Supabase service-role key. Never expose it to a browser or Electron. | Yes |
| `SUPABASE_PROJECT_ID` | Your Supabase project ref. | Recommended |
| `NEXT_PUBLIC_SUPABASE_URL` | Same public Supabase URL, only if the browser activation screen is deployed. | As applicable |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same publishable/anon key, only if the browser activation screen is deployed. | As applicable |
| `UNCODE_ALLOW_DEV_EMAIL_AUTH` | Keep `false` in production. | Yes |
| `LOG_LEVEL` | `info` (do not use debug logging for user code). | Yes |
| `BILLING_GRACE_PERIOD_DAYS` | An owner-approved number, currently `7`. | If billing is enabled |

Before pointing any user at this backend:

1. Apply the Supabase migrations in `web/supabase/migrations` to a production
   project only after they pass in a separate staging project.
2. Run the staging RLS, deletion, auth, sync, and real-provider checks in
   `docs/release/README.md` and preserve the evidence.
3. Confirm `ENABLE_MOCK_AI=false`; a deployed mock model must never be
   presented as a real explanation service.

## 2. Stripe billing (`web/`)

Leave all of these unset until the Stripe **test-mode** checkout and webhook
flows have passed. The current code safely keeps checkout disabled when any
required value is missing.

| Variable | What to fill in |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-only Stripe key. Use an `sk_test_...` key first; never expose it in client code. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from the exact deployed `/api/v1/billing/webhook` endpoint. |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID for Pro: **`$9/month`**. |
| `STRIPE_PRICE_PRO_ANNUAL` | Stripe Price ID for Pro: **`$81/year`** (about `$6.75/month`, 25% savings). |
| `STRIPE_PRICE_PRO_LIFETIME` | Stripe Price ID for Pro Lifetime: **`$80` one-time**. Optional for monthly/annual; Lifetime checkout also needs `BILLING_LIFETIME_ENABLED=true`. |
| `STRIPE_PRICE_TEAMS_MONTHLY` | Leave unset while Teams is sold by email. Setting both Teams prices opens Teams checkout (`$8/seat/month`). |
| `STRIPE_PRICE_TEAMS_ANNUAL` | Leave unset while Teams is sold by email (`$72/seat/year`). |

Do not enable live billing until you have completed a real test checkout,
verified signed webhooks (including cancellation and failed payment), tested
the customer portal, and explicitly approved the live prices. The UI price
switch is implemented, but it is not authorization to make live charges.

In the Stripe dashboard, under the subscription settings for failed payments,
set "if all retries for a payment fail" to cancel the subscription or to mark
it unpaid, never to leave it past due. Support never voids a renewal invoice
or marks it uncollectible without also canceling the subscription. In both
cases Stripe would report the subscription active again, and Unvibe would
keep giving paid access that nobody paid for.

Turning purchases off again (the lock) needs no extra step in Stripe. A
Checkout page opened before the lock can still be paid for up to about 30
minutes. For a checkout with an intent in this deployment, the webhook starts a
full refund and cancels the subscription at once, without granting access.
Checkout takes cards only, including card wallets such as Apple Pay. Link and
delayed payment methods are not offered, so payment is confirmed before the
locked checkout refund runs. After cancellation, refund recovery applies only
when we recorded that this checkout's stop started while purchases were locked;
an ordinary cancellation does not trigger it. Recovery uses that session's own
invoice and the same refund key as the duplicate-stop path. Refunds can remain
pending, fail or be disputed; a refund id alone is not proof of success. Check
older bank-debit sessions by hand, and monitor refund status updates for failures.
If the refund succeeds but cancellation fails and purchases reopen before the
retry, the customer can receive a free period; no customer loses money.

Teams self-serve checkout stays paused; Plan UI collects company email + seat
interest via mailto. There is no separate Teams switch: setting both Teams
prices opens Teams checkout.

## 3. Marketing website (`marketing/`)

Set these on the marketing hosting project for `https://unvibe.site`.

| Variable | What to fill in | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://unvibe.site` | Yes |
| `BLOB_READ_WRITE_TOKEN` | A dedicated Vercel Blob store token for durable encrypted waitlist records. | Yes for waitlist |
| `WAITLIST_ADMIN_TOKEN` | A long, random server-only secret. It also encrypts stored waitlist records; store it safely before using it. | Yes for waitlist |
| `WAITLIST_NOTIFY_EMAIL` | Your monitored support inbox. | Yes for notifications |
| `RESEND_API_KEY` | Server-only Resend key. | Strongly recommended |
| `WAITLIST_FROM_EMAIL` | A verified sender, for example `Unvibe Waitlist <waitlist@unvibe.site>`. | Yes with Resend |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Optional analytics token. Leave blank for no analytics. | Optional |

After configuring these, submit one disposable waitlist entry on the deployed
site and confirm all three outcomes: the entry is stored, it is visible to an
authorized admin, and the notification arrives from the verified sender.

## 4. Desktop DMG (`app/`)

The desktop app does **not** take AI, Supabase, Stripe, or email keys. It only
needs the approved HTTPS backend URL baked into the package:

```sh
cd app
APP_ENV=staging UNVIBE_BACKEND=https://api.unvibe.site npm run package:local
npm run verify:package
```

The generated artifact is arm64 (Apple Silicon) and is an **unsigned staging
package**. It is suitable for controlled internal QA only.

For a public macOS release, do not distribute the unsigned DMG. You must also
provide an Apple Developer membership, a Developer ID Application certificate,
and a notarization keychain profile. Follow
`docs/release/macos-signing-notarization.md` to sign, notarize, staple, run
Gatekeeper assessment, record the final SHA-256, and conduct a clean-machine
install test. The current package configuration intentionally has
`identity: null`, so it cannot truthfully be called a public-ready macOS
release yet.

## 5. Final go/no-go checklist

Before making the app publicly available, complete every blocking item in
`docs/release/release-checklist.md`, especially:

- a separate staging Supabase project with migrations and RLS tests;
- real AI-provider behavior, spend limits, and user-code handling checks;
- a Stripe test-mode checkout and webhook exercise before any live billing;
- `STRIPE_WEBHOOK_SECRET` on the production API is the real `whsec_` signing
  secret of the Stripe endpoint that delivers to the production
  `/api/v1/billing/webhook`, not a placeholder;
- the go-live webhook gate is one **signed** Stripe test event of a
  non-billing type (for example `customer.created`), sent from that Stripe
  endpoint to the production endpoint. It must answer 200. Either of two
  answers passes, because the signature is checked before anything else:
  `{"ignored":"payments_locked"}` while payments are locked, or
  `{"ignored":"livemode_mismatch"}` when a test event reaches a deployment
  with a live key. An unsigned POST is not enough: it answers 400
  `missing_signature` with a placeholder secret and with a real one alike;
- waitlist storage and email delivery on the deployed marketing site;
- signed, notarized, stapled macOS artifact plus a clean-machine QA pass;
- legal approval of the privacy policy and terms; and
- a named support/rollback owner.

Never put a secret in `NEXT_PUBLIC_*`, Electron renderer code, a DMG build
command, a Git commit, a public issue, or a pitch deck.
