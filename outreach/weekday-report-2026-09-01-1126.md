# Unvibe weekday builder outreach — 2026-09-01 11:26 PDT

## Outcome

No messages were sent or scheduled. Follow-ups were processed first; none are due because the canonical ledger still contains zero sent first touches.

Fifteen new public-source candidates were researched. Ten cleared the quality bar with scores from 87 to 96, high confidence, a concrete public AI-coding fact, and a verified public professional contact route. Their distinct first-touch drafts were added to the canonical ledger on a compliance hold. Five candidates were skipped because public evidence did not sufficiently verify eligibility or a professional contact route; volume was not forced.

## Totals

| Metric | Total |
| --- | ---: |
| Researched | 15 |
| Approved | 10 |
| Sent | 0 |
| Follow-ups | 0 |
| Bounces | 0 |
| Replies | 0 |
| Opt-outs | 0 |

“Approved” means research- and copy-approved only. Every draft remains `queued_compliance_hold` and is not authorized for delivery.

## Delivery hold

- The live outreach cron, AgentMail webhook, unsubscribe API, and unsubscribe page all return 404; the local outreach implementation is not deployed.
- The current environment lacks the AgentMail API key, inbox ID, webhook signing secret, sender reply-to, postal address, send-enable switch, founder summary recipient, and cron secret.
- The configured production Supabase API does not expose the outreach, event, customer-support, or waitlist tables, so replies, bounces, complaints, opt-outs, current support users, and waitlist membership cannot be reconciled.
- The dedicated sending domain and DKIM selector remain unknown. The root domain publishes neither SPF nor DMARC records.
- The drafts retain explicit postal-address and unsubscribe placeholders, preventing accidental delivery. No send was emulated.

## Five anonymized personalization examples

1. “A five-level dependence dial and pre-flight file map make agent decisions visible before the code changes.”
2. “Separating WebSocket control from replayable SSE events creates a useful record of what an agent actually did.”
3. “Moving voice out of a VS Code webview after microphone access failed is the kind of concrete build decision worth learning from.”
4. “Chunk compression, overconfidence checks, and 32 behavioral scenarios turn an AI tutor into a measurable learning system.”
5. “A managed-copy installer and generated capability matrix keep shared Claude Code and Codex context explicit.”

The canonical source, verified fact, fit rationale, score, confidence, public route, subject, and full held draft for every prospect are stored in the deduplicated outreach ledger.
