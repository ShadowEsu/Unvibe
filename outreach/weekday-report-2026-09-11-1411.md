# Unvibe weekday builder outreach — 2026-09-11 14:11 PDT

## Totals

| Outcome | Total |
| --- | ---: |
| Researched | 10 |
| Approved | 10 |
| Sent | 0 |
| Follow-ups | 0 |
| Bounces | 0 |
| Replies | 0 |
| Opt-outs | 0 |

## Delivery status

All approved first-touch drafts remain in `queued_compliance_hold`. No send was attempted or emulated.

The live cron, AgentMail webhook, unsubscribe API, and unsubscribe page are deployed and enforce their unauthenticated boundaries. Sending is still blocked because the current environment cannot verify the dedicated authenticated AgentMail sender or its allowance, the approved postal address, production outreach environment variables, or dedicated-domain DKIM. The connected Vercel account does not expose the linked Unvibe project, and its last downloaded production environment predates every outreach variable.

The configured production Supabase project still returns 404 for outreach contacts, messages, events, summaries, and customer-support actions. Suppressions, replies, bounces, complaints, opt-outs, and current support users therefore cannot be reconciled. Exact matching against the available waitlist found no overlap. Root-domain SPF and DMARC records are present, but they do not verify the dedicated AgentMail sending identity.

## Anonymized personalization examples

1. Referenced a student builder replacing raw Cursor-agent text-to-speech with a short AI summary, plus truncating visible output and tightening voice instructions.
2. Called out a university builder replacing a direct model integration with an agent platform, adding stricter prompts, and testing the service end to end.
3. Highlighted a third-year student separating subject knowledge into skill files so three generated agents load only the context they need.
4. Connected a student’s Cursor-built WPF desktop pet to its concrete lag fix: simpler animation and throttled background activity.
5. Referenced an MSc student’s end-to-end work on payload-bound human approval and exactly-once execution in a Codex-agent workflow.
