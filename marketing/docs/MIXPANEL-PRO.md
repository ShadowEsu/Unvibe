# Analytics operations

Do not buy add-ons or upgrade to a paid SKU that would charge the card.

## Configured analytics

- Autocapture + session replay at 100% of sessions (`marketing/src/lib/analytics.ts`)
- Named funnel events (waitlist, beta install, story beats, pricing)
- Server-side `waitlist_completed` so the north star is not browser-token dependent (`mixpanelServer.ts` + waitlist route)

## Do not spend cash on

- Extra analytics seats
- Paid data pipelines or warehouse sync
- Third-party Mixpanel plugins that bill separately

## Reporting

Cross-check the configured analytics tools; never invent conversion when `waitlist_completed` is missing.
