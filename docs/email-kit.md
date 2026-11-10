# Unvibe email kit (for the waitlist email)

The site sends one kind of email automatically, in the Unvibe team's voice.

## Identity

- **Who is talking:** the Unvibe team. "We", warm, direct, short. No personal names or roles.
- **What Unvibe is (one line):** Unvibe explains the code AI writes for you, right beside your editor, then checks you got it.
- **Mascot:** Vibe, the lilac blob. It can "say" one short line in a speech bubble. Never more.
- **Colours:** paper `#f6f1e7`, ink `#141414`, lime `#d6f45a` (main button), lilac `#b8a6ff` (Vibe), sky `#bfe3ff`, sun `#ffd86b`. No gradients, no dark mode tricks in email.
- **Type:** bold sans for headings, elegant italic serif for one accent word or phrase (the banners use Bricolage Grotesque and Instrument Serif Italic).
- **Always true facts:** free, Mac and Windows, no card, no API key, works with Cursor, VS Code and Terminal.
- **Never:** dashes in the middle of sentences, hype words ("revolutionary", "game changer"), fake urgency, made up numbers or testimonials, promises about features that are not shipped.

## Assets

| Asset | URL | Use |
| --- | --- | --- |
| Welcome banner | https://unvibe.site/email/welcome-banner.png | Older welcome emails (file kept for sent mail) |
| Site | https://unvibe.site | Main link |
| Pro | https://unvibe.site/pricing | "Want Pro?" link |
| Pro months / referrals | https://unvibe.site/rewards?ref=CODE | Person's own progress |

## 1. Waitlist / download email (automatic)

Template: `marketing/src/emails/welcome.ts`. The site sends it once to every new waitlist signup and every download with an email. Copy: unvibe-support's onboarding email 1 (Security S-2 0002): the one-line install commands for Mac and Windows, a "Get Unvibe" button to /beta, the install-help link for the first-open warning, and a footer that says whether the one setup tip follows. It has no invite link and no Pro-month offer.

- **Setup tip (email 2):** `marketing/src/lib/sendBetaDownloadEmail.ts`, scheduled by Resend for 1 day later, only for people who ticked "Also email me one setup tip tomorrow". It is the last scheduled mail for that address; adding any other lifecycle email means changing its footer in the same PR (Security O-3).
- **Feedback links** in older welcome emails still work: they are signed per email by the site (`REWARD_LINK_SECRET`) and checked by `/feedback`.
- **Do not** send it twice to the same person. `waitlist_entries.beta_email_status = 'sent'` means they already have it.
