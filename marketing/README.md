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
| `SUPABASE_URL` | Supabase project URL for waitlist storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key. Never expose to the browser. |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL for metadata, sitemap, robots, referral links. |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional. When empty, analytics is a no-op. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional PostHog host (defaults to US cloud). |

Without Supabase configured, waitlist submissions are written to `.data/waitlist.json`
(gitignored) so the form works end to end in development.

## Waitlist storage

Apply the migration in `supabase/migrations/0001_waitlist.sql` to your Supabase project
(via the SQL editor or the Supabase CLI). It creates `waitlist_entries` with row-level
security enabled and no public policies, so only the server (service role) can read or
write it.

## Analytics events

Fired only when a PostHog key is set, via a single fetch to the capture endpoint (no
third-party script, no cookies, no code contents):

`waitlist_started`, `waitlist_completed`, `demo_started`, `demo_completed`,
`depth_changed`, `code_example_selected`, `faq_opened`, `referral_copied`,
`outbound_social_clicked`, `privacy_opened`.

## Deploy to Vercel

Project: **unvibe-site** (Vercel team `evantsai2010-labs-projects`).

Staging / current production alias:

- https://unvibe-site.vercel.app

Custom domain target: **https://unvibe.site**

1. Deploy from `marketing/` (`vercel deploy --prod`) or connect the GitHub repo with
   **Root Directory** `marketing` and **Production Branch** `marketing`.
2. Env vars are set on the Vercel project (`NEXT_PUBLIC_SITE_URL=https://unvibe.site`,
   Supabase, `WAITLIST_NOTIFY_EMAIL`, etc.).
3. Domains `unvibe.site` and `www.unvibe.site` are attached in Vercel.

### GoDaddy DNS (required for unvibe.site)

The domain currently uses GoDaddy Website Builder nameservers
(`ns47.domaincontrol.com` / `ns48.domaincontrol.com`). Point it at Vercel instead:

In GoDaddy → **unvibe.site** → **DNS** → **Records**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` | 600 |
| CNAME | `www` | `cname.vercel-dns.com` | 600 |

Remove or disable any GoDaddy Website Builder / forwarding records that conflict.
After DNS propagates, https://unvibe.site should serve this Next.js waitlist site
(not the GoDaddy builder page).

Optional alternate: change nameservers to `ns1.vercel-dns.com` and
`ns2.vercel-dns.com` (then manage DNS in Vercel).

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
