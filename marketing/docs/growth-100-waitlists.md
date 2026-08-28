# Growth execution · 100+ waitlists / day

Dated: 2026-08-23. Owner: CMO drafts · COO ships · CEO clears public claims.

## Math (honest)

Recent PostHog (UTC, filter test accounts): `waitlist_started` ~4–13/day. Traffic is the bottleneck, then conversion, then viral loop.

Path to 100 completed / day without paid ads yet:

| Lever | Target contribution | Owner |
|-------|---------------------|--------|
| Founder posts (X/LinkedIn/HN Show) | 30–50 joins / strong day | Founder + CMO copy |
| Referral loop (share in 60s) | 1.2–1.5× multiplier on organic | COO (shipped UX) |
| Weekend AgentMail (max 10) | 5–15 joins Sat | CMO (window Sat 09:30–12:30 PT) |
| Niche communities (Cursor/AI builders) | 10–25 / week sustained | Founder posts |
| Paid later | only after completed gauge works 7d | CFO gate |

## Funnel events to watch (PostHog + Mixpanel)

Site:

- `waitlist_viewed` → `waitlist_started` → `waitlist_completed`
- `referral_copied` / `referral_shared`
- `beta_install_viewed` → `beta_install_os_selected` → `beta_install_copied` (props: `os=mac|windows`)
- `beta_install_fetched` (server, when curl/PowerShell actually hits `/api/install` or `/api/install-windows`)
- `survey_opened` / `feedback_opened` (click + `/feedback` redirect)

North star: unique `waitlist_completed` per day.

## Composio connectors (X + OpenAI)

Use founder tokens through Composio so agents post and call models without pasting keys into chat.

1. **OpenAI** — connect once: paste your OpenAI API key in the Composio auth UI, then agents use `OPENAI_*` tools on that connection.
2. **X / Twitter** — Composio has no managed Twitter OAuth yet. Set up auth config first: [Set up twitter](https://dashboard.composio.dev/~/org/connect/apps/twitter?open=true). After that, reconnect and use `TWITTER_CREATION_OF_A_POST` to schedule/automate from the pack below.
3. Do not run OpenAI or Twitter tools until the connection shows Active.

## 14-day plan to 100+ waitlists

Days 1–2: ship tracking (done), verify events live, pin one X thread + one LinkedIn post.

Days 3–7: post daily from the pack (1–2/day). Reply to every Cursor/Claude “I don’t understand this diff” thread with the product link, not a pitch essay. Keep AgentMail drafts only until Sat window.

Days 8–10: Show HN once. Recycle best reply into a short clip or screenshot of the overlay. Push referral share after every join.

Days 11–14: double down on the channel that produced completed joins. Pause channels that only get impressions. If completed stays under 20/day after traffic, fix landing CTA before buying ads.

## Founder posts (paste as-is)

### X 1 · problem

AI can ship a whole feature before you understand what it did to your repo.

Unvibe is a Mac overlay that explains AI-written code in your editor, at your level, with project context. Private beta is open.

https://unvibe.site

### X 2 · install

Private Mac beta is one paste away:

curl -fsSL https://unvibe.site/api/install | bash

Windows PowerShell path is on the same page. 30 explanations, then a short survey.

https://unvibe.site

### X 3 · not codegen

Not another codegen tool.

Unvibe sits beside Cursor and VS Code so you can review, understand, and keep what the agent just wrote. Secrets stay on your machine.

Join the waitlist: https://unvibe.site

### X 4 · referral

If Unvibe already clicked for you, share your link from the waitlist confirmation. Friends jump the line; you both get credit when they join.

https://unvibe.site

### X 5 · Windows

Windows x64 trial is live too. Same 30 AI explanations as Mac. Install from PowerShell on https://unvibe.site

Unsigned build, so SmartScreen may warn. Tell us what broke after you try it.

### X 6 · builder weekend

Building with Cursor/Claude this weekend and drowning in diffs you will not remember Monday?

Unvibe explains the change in your editor, then saves what you learned. Private beta: https://unvibe.site

### LinkedIn

AI coding compresses implementation time. Review and ownership still take the time you skipped.

Unvibe is a desktop overlay for Cursor and VS Code: select the change, get a streamed explanation with project context, test that you actually get it, keep the note.

Private beta: https://unvibe.site

### Hacker News (Show HN)

Show HN: Unvibe – understand AI-written code in your editor (private beta)

I kept shipping Cursor/Claude changes I could not explain later. Unvibe is a small Mac overlay: select code or diff, get a streamed explanation with citations, then save what you learned.

Not another codegen tool. Comprehension layer. Secrets filtered on device before anything leaves the machine.

https://unvibe.site

Happy to answer architecture / privacy questions.

## AgentMail batch (NEXT Saturday only · max 10 · need explicit "send")

Subject: AI wrote it. Do you still own it?

Body template:

Hey {first},

Saw {concrete proof they ship with AI / Cursor / Claude}.

Unvibe is a Mac overlay that explains AI-written code in your editor so you can verify and keep it. Private beta: https://unvibe.site/?utm_source=agentmail&utm_medium=email&utm_campaign=builders_2026_08_30

Worth a look if the bottleneck is understanding, not generating.

Preston
Unvibe

Prospect list: research via CMO outreach skill in-window; do not send outside Sat 09:30–12:30 America/Los_Angeles; cap 10.

## Verify after deploy

1. Join once on unvibe.site → PostHog shows `waitlist_completed` within minutes.
2. Focus form → `waitlist_started`; load alone → `waitlist_viewed` only.
3. Copy Mac and Windows install → `beta_install_copied` with `os`.
4. Hit curl/PowerShell install URL → `beta_install_fetched`.
5. Open feedback link → `feedback_opened` / `survey_opened`.
6. Daily North Star = unique `waitlist_completed` (not started).
