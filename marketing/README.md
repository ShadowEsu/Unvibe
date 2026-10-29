# Unvibe marketing site

The launch site for **Unvibe** — a Mac desktop companion that explains the code your AI
agent writes, at the depth you choose, and checks that you understood it.

> AI can write the code. Unvibe helps you understand it.

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, and a
privacy-respecting analytics abstraction (named Mixpanel and optional PostHog events,
no vendor script). It is independent of the product backend in `../web`.

## Run locally

```bash
cd marketing
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm start          # serve the production build
npm run lint       # next lint
npx tsc --noEmit   # type check
```

## Environment

Copy `.env.example` to `.env.local`. Everything is optional for local development.

| Variable | Purpose |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Server-only Vercel Blob credential for durable production waitlist storage. |
| `WAITLIST_ADMIN_TOKEN` | Long random server-only secret for admin access and waitlist encryption. |
| `WAITLIST_NOTIFY_EMAIL` | Legacy configuration only. Signup notifications are intentionally locked to `support@unvibe.site`. |
| `RESEND_API_KEY` | Recommended server-only Resend credential for reliable signup email. |
| `WAITLIST_FROM_EMAIL` | Verified sender used by Resend. |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata, sitemap, robots, referral links. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL used for founder Google sign-in. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase browser key (preferred). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy public key fallback when no publishable key exists. |
| `FOUNDER_EMAILS` | Server-only comma-separated founder Google accounts allowed to update `/build`. |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Optional Mixpanel project token for the browser SDK. Autocapture and session replay are on. |
| `MIXPANEL_TOKEN` | Optional Mixpanel project token (server only). Fallback named events via `/api/analytics`. |
| `MIXPANEL_HOST` | Optional Mixpanel API host (defaults to `https://api.mixpanel.com`). |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional PostHog project key. Named events only. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional PostHog host (defaults to US cloud). |
| `UNVIBE_API_URL` | Product backend origin, used by `/stats` for desktop app user counts. |
| `UNVIBE_ADMIN_STATS_TOKEN` | Server-only secret, 24+ characters, matching the backend's `UNVIBE_ADMIN_STATS_TOKEN`. |

Without Vercel Blob configured, waitlist submissions are written to `.data/waitlist.json`
(gitignored) so the form works end to end in development. Production fails closed when durable
storage is missing; it never reports a signup as saved to ephemeral serverless storage.

The public `/build` page also uses Blob for its tiny status document. `/founder` signs in
through Supabase Google OAuth, and the API verifies the bearer token and server-only founder
email allow-list before accepting a start, heartbeat, note, or stop action.

## Waitlist storage

Connect a Vercel Blob store to the marketing project, then set `WAITLIST_ADMIN_TOKEN` to a
long random value. Entries are AES-256-GCM encrypted before upload and the admin endpoint is
bearer-token protected. The old `supabase/migrations/0001_waitlist.sql` is retained for history,
but the current marketing storage adapter does not use it.

Configure Resend for signup notifications (they always go to `support@unvibe.site`; `WAITLIST_NOTIFY_EMAIL` is ignored).
Failed deliveries remain visible and retryable in `/waitlist`. Signups are still saved when
email delivery fails.

## Analytics events

Fired when Mixpanel and/or PostHog is configured. Mixpanel loads `mixpanel-browser`
with autocapture and session replay on, then tracks named events. `/api/analytics`
remains as a fallback when the browser token is unset. No code contents, no emails:

`page_viewed`, `waitlist_started`, `waitlist_completed`, `demo_started`, `demo_completed`,
`depth_changed`, `code_example_selected`, `faq_opened`, `referral_copied`,
`outbound_social_clicked`, `privacy_opened`, `pricing_viewed`, `billing_interval_selected`,
`plan_cta_clicked`, `release_download_clicked`, `beta_install_viewed`,
`beta_install_os_selected`, `beta_install_copied`, `beta_install_fetched`,
`survey_opened`, `feedback_opened`.

The desktop app does not send Mixpanel events. Do not copy the Mixpanel snippet into
`app/`.

## Deploy to Vercel

1. Import the repository into Vercel and set the project root to `marketing/`.
2. Connect a Vercel Blob store and add the remaining environment variables above.
3. Configure Resend, then submit a disposable test entry.
4. Confirm the entry appears in `/waitlist` and the founder notification is marked sent.
5. Vercel auto-detects Next.js; the default build (`next build`) is used.
6. Point your domain and set `NEXT_PUBLIC_SITE_URL` to match.

## Structure

```
src/
  app/            routes, layout, metadata, legal pages, robots, sitemap, waitlist API
  components/     chrome (Nav, Footer, Logo, Button, Section) + providers
  components/sections/   every landing section
  lib/            tokens, motion, analytics, examples, languages, schema, utils
  data/           faq content
supabase/migrations/     waitlist table + RLS
docs/             MOTION.md, ASSETS.md
public/           brand + product screenshots
```

## Notes

- Design: soft white base, restrained purple, serif display / sans body / mono code.
- Accessibility: landmarks, visible focus, skip link, keyboard-operable interactives,
  and every moving element pauses (hover, off-viewport, or `prefers-reduced-motion`).
- Copy reflects the product honestly: Mac first, no screen recording or OCR, cloud
  explanations with on-device secret filtering, no local-only mode yet, no fake certs.

## Post-release site details

- Newsletter consent uses a 20 px ink checkbox aligned to the first label line; the label remains clickable.
- The hero programs total is the only underlined text within one link. At 480 px and below, the program count and trust items use separate lines without separators.
- The home programs pills are capped at 50 rem, with a 32 px Claude for Startups subheading.
- About card lists use 18 px text, no indent and 9 px gaps. Footer analytics settings shares the link row sizing.
- The tour keeps its responsive poster over the video until `playing`, without intercepting controls or changing reduced-motion playback.
- The backend `/activate` agreement note keeps its top spacing and leaves 14 px below it before sign-in.
