# Mixpanel Pro (startup credits)

Unvibe is on **Mixpanel for Startups** with **$144,000** of Mixpanel Pro plan credits (1 year). Use Pro features that the credit plan includes. Do not buy add-ons or upgrade to a paid SKU that would charge the card.

## Included Pro usage we turn on

- Autocapture + session replay at 100% of sessions (`marketing/src/lib/analytics.ts`)
- Named funnel events (waitlist, beta install, story beats, pricing)
- Server-side `waitlist_completed` so the north star is not browser-token dependent (`mixpanelServer.ts` + waitlist route)

## Do not spend cash on

- Extra Mixpanel seats beyond the credit plan
- Paid data pipelines or warehouse sync unless credits cover them
- Third-party Mixpanel plugins that bill separately

## CEO / CMO read path

Composio Mixpanel alias `unvibe`, `project_id=4054892`. Prefer `MIXPANEL_QUERY_SEGMENTATION` and JQL. Cross-check PostHog; never invent conversion when `waitlist_completed` is missing.
