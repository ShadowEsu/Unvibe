# Growth execution · 100+ waitlists / day

Dated: 2026-08-23. Owner: CMO drafts · COO ships · CEO clears public claims.

## Math (honest)

Recent PostHog (UTC, filter test accounts): `waitlist_started` ~4–13/day (was form mount; now intent-only). `waitlist_completed` was **0** in client analytics for 30d while live `/api/waitlist` saves work. Traffic is the bottleneck, then conversion, then viral loop.

Path to 100 completed / day without paid ads yet:

| Lever | Target contribution | Owner |
|-------|---------------------|--------|
| Founder posts (X/LinkedIn/HN Show) | 30–50 joins / strong day | Founder + CMO copy |
| Referral loop (share in 60s) | 1.2–1.5× multiplier on organic | COO (shipped UX) |
| Weekend AgentMail (max 10) | 5–15 joins Sat | CMO (window Sat 09:30–12:30 PT) |
| Niche communities (Cursor/AI builders) | 10–25 / week sustained | Founder posts |
| Paid later | only after completed gauge works 7d | CFO gate |

## Shipped this run

- Server `waitlist_completed` capture on successful save
- `waitlist_viewed` on form mount; `waitlist_started` on first focus
- Post-join: visible link + Copy + Share (native / X intent) + `referral_shared`

## Founder posts (paste as-is; claim hygiene OK)

### X / LinkedIn

AI can ship a whole feature before you understand what it did to your repo.

Unvibe is a Mac overlay that explains AI-written code in your editor, at your level, with project context. Private beta is open.

Join: https://unvibe.site
Install path on the site: curl | bash for Mac.

If you vibe-code and then freeze on review, this is for you.

### Hacker News (Show HN draft)

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
3. Daily North Star = unique `waitlist_completed` (not started).
