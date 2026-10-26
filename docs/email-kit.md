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
| Welcome banner | https://unvibe.site/email/welcome-banner.png | Waitlist and download emails |
| Site | https://unvibe.site | Main link |
| Pro | https://unvibe.site/pricing | "Want Pro?" link |
| Pro months / referrals | https://unvibe.site/rewards?ref=CODE | Person's own progress |

## 1. Waitlist / download email (automatic)

Template: `marketing/src/emails/welcome.ts`. The site sends it once to every new waitlist signup and every download with an email. Sections: banner, "Congrats, you're in early!", get the app, Want Pro?, their invite link, feedback for another month, thanks from the Unvibe team.

- **Invite link:** `https://unvibe.site/?ref=CODE`. CODE is the first 8 hex characters of sha256(lowercased email) and is in `waitlist_entries.referral_code`. When a new person joins with it, both get a month of Pro (max five friends, stacks).
- **Feedback link:** signed per email by the site (`REWARD_LINK_SECRET`). Stars plus at least 8 words earns one more month, once per email. Agents cannot make these links by hand; the site generates them.
- **Do not** send it twice to the same person. `waitlist_entries.beta_email_status = 'sent'` means they already have it.
