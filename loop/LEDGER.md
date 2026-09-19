# Marketing loop ledger

## 19 SEP 2026

- Agent: marketing website only. Confirmed git branch `main` tracking `origin/main` at `ad06644` (Refine companion navigation and quiz). No website edits. Waiting for the first site task.
- Scope lock: `marketing/` only. Do not touch `app/`, `extension/`, or `web/` unless asked. Do not migrate marketing or web onto AWS/ECS.
- Note: `loop/LEDGER.md` was missing on disk. Created it so this pass is recorded.

- Homepage hero headline was billboard sized (`clamp(3.8rem, 12vw, 8.6rem)`). Reduced `.paper-hero h1` to quote scale (`clamp(1.45rem, 3vw, 2.15rem)`), closer to the italic kicker. Verified on local `http://localhost:3000`. Skipped changelog. No commit.

- Founder said quote-scale hero was too small. Moved `.paper-hero h1` to a mid size that fills the hero without the old poster type: `clamp(2.8rem, 8vw, 5.15rem)`, max width `min(34rem, 90vw)`. Checked on local `http://localhost:3000`. No overlap with the countdown. Skipped changelog. No commit.

- Founder asked bigger again. Hero h1 is now `clamp(3.3rem, 10vw, 6.5rem)`. Still below the old 8.6rem cap. Local check: no overlap with the countdown. No commit.

- Centered homepage install tabs and the Mac .dmg link. Added WaitlistInvite at the bottom of `/`. Nav and footer Join waitlist now go to `/#waitlist` instead of `/waitlist`. Clicked footer link: stayed on home, hash `#waitlist`, form visible. Changelog entry 19 SEP 2026. No commit.

- Removed the 7 SEP 2026 release-day countdown from PhotoHero and deleted `ReleaseCountdown.tsx`. No new public date. Changelog entry 19 SEP 2026. No commit.

- Homepage waitlist now uses the paper card: `paper-waitlist` class, copy "Mac ships first. Windows can join the list.", white Join button, UNVIBE SPECIAL referral fields. Matched founder screenshot on local `#waitlist`. Did not submit the form. No commit.

- Companion sidebar: Home and Chat pinned. Other pages under Spaces. Usage moved above Settings and made larger. Titlebar search and sidebar toggle enlarged. Sidebar uses small system UI type like Granola. App only. Could not open the Electron companion here. No commit.

- Companion Home: greeting Hi there plus first name, system UI type, Explain plus shortcut in the header, local month grid from learning heat (no Calendar permission), reviews as the main list. Preview screenshot from a static mock. No commit.

- Dropped the HTML mock. Home greeting uses Newsreader again. Onboarding step 2 is name plus optional email and writes settings before completeOnboarding. Building Electron for the real window. No commit.

- Onboarding already uses sanFranWash plus Golden Gate. Locked that dusk coral and blue wash even in light theme so setup does not bleach white. No commit.

- Usage rings (AI and Select remaining) on companion Home, sidebar, Island, and the review widget used over Terminal. Island is smaller and hangs from the camera/menu bar. Selected chrome is grey, not purple. Built ok. Restart Unvibe to see it. No commit.

- Root `npm run dev` now builds and launches the Electron companion via `app`. No commit.

- App only. Island sits in the notch as a small system-font pill, native grow/shrink, pixel working state, Pulse/Ask kept. Terminal keeps explanation on the left and puts Test me on the right. Learn and History are one page. Companion rail has smaller labels plus a left search and hide control. No commit.

## Handoff for the marketing / website chat

This chat is now marketing website only (`marketing/`). App work stays in the other thread. Do not edit `app/` from here.

Founder asked this app chat to pass this on. Website chat should own it. Do not wait for another prompt from Preston.

1. Ship a new public Mac `.dmg` so everyone can install a build that still includes the Free 30 AI explanations per month. Put that file on the live download path testers already use.
2. Get Pro and the other paid plans ready on the site. Preston will connect the live Stripe account soon. Until then, Stripe test is fine, but the buttons must be real checkout, not dead copy.
3. Pressing Get Pro (or the matching plan) on the website or in the desktop app should open Stripe Checkout. After payment, that account should receive Pro. Easiest path is Stripe Checkout plus the existing webhook that grants the plan. A promo or gift code that upgrades to Pro is an acceptable extra if Checkout is slower to finish.
4. Do not invent a new billing backend. Reuse `web/` Stripe + Supabase plan state. Keep waitlist APIs untouched.

## App pass (this chat)

- Typecheck passed (`app` `tsc --noEmit`). Island size setting, notch panel window, idle blink, Granola sidebar spacing, and the marketing Stripe/DMG handoff are in the working tree. No commit.

- Homepage polish: transparent nav over the hero that turns into pale glass on scroll. Hero kicker is three short sentences plus Mac/Windows waitlist buttons. Faster fade. Video caption tightened. Section order unchanged. No waitlist submit. No commit.

- Hero type was too faint on the fog. Darkened `--hero-veil` a little, set the headline to white with a soft shadow. Checked local `http://localhost:3000/` and `#waitlist` (first/last/email, referral closed, did not submit). Nav turns pale glass after scroll. Next overlay still shows a hydration warning in dev. No commit.

- Dark developer-tools rebuild: product hero, honest Teams labels, FounderMag, /product /teams /about /press. Typecheck, 36 tests, production build passed (`/` 149 kB first load). Waitlist API unchanged. Not deployed. No commit.

- Founder rejected the dark rebuild. Restored marketing/ to 98e1d73 (Golden Gate paper homepage). Deleted studio pages and OG v7. App and web files left alone. No commit.
