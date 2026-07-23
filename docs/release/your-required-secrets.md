# Unvibe launch configuration — values you need to supply

This is the short checklist for configuring Unvibe without putting secrets in
Git, the marketing browser bundle, or the desktop app. Fill the values in the
hosting dashboards / secret manager only. Do **not** paste them into this file,
commit them, or send them to testers.

## 1. Backend and desktop API (`web/`)

Set these on the deployed backend project (the service the desktop app calls,
currently intended to be `https://api.unvibe.site`).

| Variable | What to fill in | Required for public use |
| --- | --- | --- |
| `APP_ENV` | `production` only after staging has passed. | Yes |
| `WEB_BASE_URL` | The backend's public HTTPS URL, for example `https://api.unvibe.site`. | Yes |
| `PUBLIC_APP_URL` | The trusted HTTPS return URL for Billing Checkout/Portal. Use the public web app origin that hosts `/plan`. | Yes for billing |
| `ENABLE_MOCK_AI` | `false` for real explanations. | Yes |
| `ANTHROPIC_API_KEY` **or** `GEMINI_API_KEY` | One server-only AI-provider key. Start with a restricted key and a spend limit. | Yes |
| `UNCODE_MODEL` or `GEMINI_MODEL` | The approved model name for the selected provider. | Yes |
| `SUPABASE_URL` | Your production Supabase project URL. | Yes |
| `SUPABASE_ANON_KEY` | The Supabase publishable/anon key. | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | The server-only Supabase service-role key. Never expose it to a browser or Electron. | Yes |
| `SUPABASE_PROJECT_ID` | Your Supabase project ref. | Recommended |
| `NEXT_PUBLIC_SUPABASE_URL` | Same public Supabase URL, only if the browser activation screen is deployed. | As applicable |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same publishable/anon key, only if the browser activation screen is deployed. | As applicable |
| `UNCODE_ALLOW_DEV_EMAIL_AUTH` | Keep `false` in production. | Yes |
| `LOG_LEVEL` | `info` (do not use debug logging for user code). | Yes |
| `BILLING_GRACE_PERIOD_DAYS` | A founder-approved number, currently `7`. | If billing is enabled |

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
| `STRIPE_PRICE_PRO_MONTHLY` | Trusted Stripe Price ID for Pro: `$8/month`. |
| `STRIPE_PRICE_PRO_ANNUAL` | Trusted Stripe Price ID for Pro: `$72/year` (about `$6/month`, 25% savings). |
| `STRIPE_PRICE_TEAMS_MONTHLY` | Optional. Only if Teams checkout is re-enabled. |
| `STRIPE_PRICE_TEAMS_ANNUAL` | Optional. Only if Teams checkout is re-enabled. |

Do not enable live billing until you have completed a real test checkout,
verified signed webhooks (including cancellation and failed payment), tested
the customer portal, and explicitly approved the live prices. The UI price
switch is implemented, but it is not authorization to make live charges.

## 3. Marketing website (`marketing/`)

Set these on the marketing hosting project for `https://unvibe.site`.

| Variable | What to fill in | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://unvibe.site` | Yes |
| `BLOB_READ_WRITE_TOKEN` | A dedicated Vercel Blob store token for durable encrypted waitlist records. | Yes for waitlist |
| `WAITLIST_ADMIN_TOKEN` | A long, random server-only secret. It also encrypts stored waitlist records; store it safely before using it. | Yes for waitlist |
| `WAITLIST_NOTIFY_EMAIL` | Your monitored founder/support inbox. | Yes for notifications |
| `RESEND_API_KEY` | Server-only Resend key. | Strongly recommended |
| `WAITLIST_FROM_EMAIL` | A verified sender, for example `Unvibe Waitlist <waitlist@unvibe.site>`. | Yes with Resend |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional analytics key. Leave blank for no analytics. | Optional |
| `NEXT_PUBLIC_POSTHOG_HOST` | Your approved PostHog host, if analytics is enabled. | Optional |
| `NEXT_PUBLIC_DEMO_VIDEO_URL` | Optional HTTPS demo video URL. | Optional |

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
- waitlist storage and email delivery on the deployed marketing site;
- signed, notarized, stapled macOS artifact plus a clean-machine QA pass;
- legal approval of the privacy policy and terms; and
- a named support/rollback owner.

Never put a secret in `NEXT_PUBLIC_*`, Electron renderer code, a DMG build
command, a Git commit, a public issue, or a pitch deck.
