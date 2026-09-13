# Unvibe weekday builder outreach — 2026-08-31 09:46 PDT

## Outcome

No messages were sent or scheduled. Fifteen new first-touch drafts cleared the research-quality bar and were added to the canonical ledger on a compliance hold. Each has a public professional contact route, a public source URL, a concrete project fact, explicit AI-coding-tool evidence, an Unvibe fit rationale, a score of at least 80, and high confidence. Exact waitlist matching found no overlap; the canonical ledger also has no prior touch for any of the selected prospects.

Follow-ups were processed first. None are due because the canonical ledger contains no sent first touch. External reply, bounce, complaint, and suppression events cannot be reconciled because the AgentMail sender and webhook are unavailable.

## Totals

| Metric | Total |
| --- | ---: |
| Researched | 22 |
| Approved | 15 |
| Sent | 0 |
| Follow-ups | 0 |
| Bounces | 0 |
| Replies | 0 |
| Opt-outs | 0 |

“Approved” means research- and copy-approved only. Every draft remains `queued_compliance_hold` and is not authorized for delivery.

## Delivery hold

- The live cron, AgentMail webhook, unsubscribe API, and unsubscribe page all return 404 at `unvibe.site`; the local outreach implementation has not been deployed.
- The current environment lacks the AgentMail API key, inbox ID, webhook signing secret, sender reply-to, postal address, send-enable switch, and cron secret.
- The outreach and customer-support tables are not available through the configured production Supabase API, so the additive migration and synchronized suppression/event ledger cannot be verified live.
- The dedicated sending domain is unknown; its SPF, DKIM, and DMARC cannot be verified. The root domain publishes no SPF or DMARC record.
- A dedicated authenticated AgentMail sender, current allowance, event stream, public one-click unsubscribe flow, approved physical address, and exact support-user suppression check therefore remain unavailable.

The stored drafts include explicit `{{POSTAL_ADDRESS}}` and `{{UNSUBSCRIBE_URL}}` placeholders so they cannot be mistaken for deliverable mail. No send was emulated.

## Five anonymized personalization examples

1. “Your evidence-gated research workflow stood out, especially the choice to keep judgment human while the coding agent handles repetitive structure.”
2. “The repo-local plugin’s teach-back prompts and retrieval warm-ups make the daily robotics notebooks more than generated lessons.”
3. “Five collaborating agents and thirteen consistency checks create exactly the kind of moving context a builder still needs to understand.”
4. “A real-time district leaderboard built in roughly ninety minutes is a sharp example of speed creating an ownership gap after the build.”
5. “The four-axis mastery graph and Feynman loop measure understanding instead of generating another summary.”

The canonical source, verified fact, fit rationale, score, confidence, public route, subject, and full held draft for every prospect are stored in `outreach/outreach-ledger.jsonl`.
