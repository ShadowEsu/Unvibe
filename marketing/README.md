# Unvibe marketing site

The launch site for **Unvibe** — a Mac desktop companion that explains the code your AI
agent writes, at the depth you choose, and checks that you understood it.

> AI can write the code. Unvibe helps you understand it.

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, and a
privacy-respecting analytics abstraction. It is independent of the product backend in
`../web`.

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
| `WAITLIST_NOTIFY_EMAIL` | Legacy configuration only. Signup notifications are intentionally locked to `preston@unvibe.site`. |
| `RESEND_API_KEY` | Recommended server-only Resend credential for reliable signup email. |
| `WAITLIST_FROM_EMAIL` | Verified sender used by Resend. |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata, sitemap, robots, referral links. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional. When empty, analytics is a no-op. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional PostHog host (defaults to US cloud). |

Without Vercel Blob configured, waitlist submissions are written to `.data/waitlist.json`
(gitignored) so the form works end to end in development. Production fails closed when durable
storage is missing; it never reports a signup as saved to ephemeral serverless storage.

## Waitlist storage

Connect a Vercel Blob store to the marketing project, then set `WAITLIST_ADMIN_TOKEN` to a
long random value. Entries are AES-256-GCM encrypted before upload and the admin endpoint is
bearer-token protected. The old `supabase/migrations/0001_waitlist.sql` is retained for history,
but the current marketing storage adapter does not use it.

Configure Resend for founder notifications (`WAITLIST_NOTIFY_EMAIL`, default `preston@unvibe.site`).
Failed deliveries remain visible and retryable in `/waitlist`. Signups are still saved when
email delivery fails.

## Analytics events

Fired only when a PostHog key is set, via a single fetch to the capture endpoint (no
third-party script, no cookies, no code contents):

`waitlist_started`, `waitlist_completed`, `demo_started`, `demo_completed`,
`depth_changed`, `code_example_selected`, `faq_opened`, `referral_copied`,
`outbound_social_clicked`, `privacy_opened`.

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
