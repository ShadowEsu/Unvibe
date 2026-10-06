# Unvibe email kit (for the outreach and waitlist agents)

Two kinds of email go out under Unvibe's name. Both sound like Preston, a real person, not a company.

## Identity

- **Who is talking:** Preston Susanto, student founder. First person, warm, direct, short.
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
| Outreach banner | https://unvibe.site/email/outreach-banner.png | Cold outreach |
| Site | https://unvibe.site | Main link |
| Pro | https://unvibe.site/pricing | "Want Pro?" link |
| Pro months / referrals | https://unvibe.site/rewards?ref=CODE | Person's own progress |

## 1. Waitlist / download email (automatic)

Template: `marketing/src/emails/welcome.ts`. The site sends it once to every new waitlist signup and every download with an email. Sections: banner, "Congrats, you're in early!", get the app, Want Pro?, their invite link, feedback for another month, thanks from Preston.

- **Invite link:** `https://unvibe.site/?ref=CODE`. CODE is the first 8 hex characters of sha256(lowercased email) and is in `waitlist_entries.referral_code`. When a new person joins with it, both get a month of Pro (max five friends, stacks).
- **Feedback link:** signed per email by the site (`REWARD_LINK_SECRET`). Stars plus at least 8 words earns one more month, once per email. Agents cannot make these links by hand; the site generates them.
- **Do not** send it twice to the same person. `waitlist_entries.beta_email_status = 'sent'` means they already have it.

## 2. Outreach email (sent by agents, one at a time)

Template: `marketing/src/emails/outreach.ts` (`outreachHtml`, `outreachText`). Fill:

- `firstName` if known.
- `personalLine`: one true, specific sentence about them, e.g. "Saw your Cursor tips thread on r/learnprogramming, the one about reviewing diffs." If you cannot write a true one, do not send.
- `link`: `https://unvibe.site` or with `?ref=CODE` when a referrer should get credit.

Subject lines to rotate: "Quick one: do you read the code AI writes for you?", "Built this for people shipping with Cursor", "Free tool for understanding AI-written code".

Rules:

1. Only people with a public reason to care (devs, students, CS clubs, bootcamps, AI coding communities). No bought lists.
2. One email plus at most one follow up after 5 days. Stop at any reply that says no.
3. Every email keeps the "reply no thanks" line and Preston's real name and site.
4. Send from Preston's own address, plain and personal, never as a blast.
5. Log who was emailed and when, so nobody gets double contacted.
