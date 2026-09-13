# Unvibe weekday builder outreach — 2026-08-28 07:20 PDT

## Outcome

No messages were sent or scheduled. The canonical ledger was missing and has been rebuilt at `outreach/outreach-ledger.jsonl` with a verified zero-send history before any delivery decision. This run is outside the earliest permitted recipient-local send time (08:30), and every delivery prerequisite remains unavailable.

## Delivery and compliance gate

| Gate | Result |
| --- | --- |
| Dedicated Composio AgentMail connector in this environment | Unavailable — no callable AgentMail/Composio tool is configured |
| Dedicated sender and remaining daily allowance | Cannot verify |
| SPF, DKIM, and DMARC for the dedicated sending domain | Cannot verify — dedicated domain/selector unknown |
| Approved physical mailing address | Missing from approved configuration |
| Functioning one-click unsubscribe endpoint and suppression list | Missing/unavailable |
| Reply, bounce, complaint, click, and booked-meeting events | Unavailable |
| Verified booking URL | Not configured |
| Local-time / holiday eligibility | Not evaluated for delivery; no recipient has a valid public contact route |

The surviving legacy configuration describes `unvibe@agentmail.to`, but it is not an available Composio connection in this run and is therefore not an authorized sender.

## Counters

| Metric | Count |
| --- | ---: |
| Due follow-ups checked | 0 |
| Follow-ups sent | 0 |
| Public-source candidates revalidated | 21 |
| Candidates scored 65+ | 18 |
| New first-touch approval-queue items | 15 (compliance-held) |
| First touches sent or scheduled | 0 |
| Bounces / replies / opt-outs / complaints | 0 / 0 / 0 / 0 (events unavailable) |
| Booked meetings | 0 (events unavailable) |
| Day running total of first touches | 0 / 20 |

## Extended research outcome

The research queue now contains 15 distinct student/young-builder candidates, each with an individually verified public email address from a self-published portfolio or public GitHub profile, a concrete current project/work signal, explicit AI-coding-tool evidence, and a score of 75–95. The complete source, exact fact, fit explanation, score, confidence, contact route, and held status are in the canonical ledger.

These entries are **not sent or scheduled** and are not yet deliverable approval items: all remain `queued_compliance_hold` until the dedicated AgentMail connector, sender-domain authentication, approved physical address, one-click unsubscribe, suppression list, event stream, recipient deduplication, and recipient-local time/holiday checks are available.

## Earlier research outcome

Three candidates reached the minimum fit score but none had a legitimate public professional contact route. They remain research holds, not approval-queue recipients:

| Public profile | Score | Concrete current proof | Status |
| --- | ---: | --- | --- |
| [nathanjzhao](https://github.com/nathanjzhao) | 85 | Active DataBoard repository contains `AGENTS.md` and `CLAUDE.md`, with a documented privacy-first implementation and E2E tests. | Hold — no public professional contact |
| [garysun1](https://github.com/garysun1) | 65 | Omegaplan is a VS Code coding-agent planning/review extension with a GPT-4o bridge-agent and SSE events. | Hold — no public professional contact; AI-coding-tool use unverified |
| [Donglomur](https://github.com/Donglomur) | 65 | brain-researcher-benchmark evaluates how coding agents can produce runnable results without the needed scientific judgement. | Hold — no public professional contact |

Three additional public projects were reviewed and deliberately skipped: RealityHacks26-OurLife (60; no public AI-coding-tool signal/contact), MandateFi (55; no public AI-coding-tool signal/contact), and interval-utils (40; insufficient complexity/signal/contact). The ledger stores their exact public facts, scores, fit rationale, and confidence.

## Five anonymized, evidence-backed personalization examples

1. Candidate A — “Your DataBoard repository’s decision to make the privacy schema transparent while proving the UI flows end to end is exactly the kind of code path where an AI-assisted change still needs to be understood, not merely accepted.”
2. Candidate B — “I noticed Omegaplan places agent planning, execution, approval, and review inside a VS Code workflow rather than treating the agent as a black box.”
3. Candidate C — “Your benchmark’s distinction between an agent running a pipeline and a researcher recognizing the missing robustness check gets at the ownership gap Unvibe is designed to support.”
4. Candidate D — “The OurLife implementation combines speech, image, location, and a WebSocket backend into a system whose generated glue code deserves careful, contextual review.”
5. Candidate E — “MandateFi’s explicit evidence records, typed recommendations, and deterministic policy gate show a serious approach to keeping AI-agent behaviour inspectable.”

These are research examples only: none was emailed, and no email draft was created without a valid public contact route and a passing delivery/compliance gate.

## Setup needed before the 15-item queue can become sendable

1. Expose the dedicated Composio AgentMail connector to this automation and verify its sender identity and current allowance.
2. Configure and make verifiable the dedicated domain’s SPF, DKIM, and DMARC.
3. Provide the approved physical mailing address, an actual one-click unsubscribe endpoint, and the synchronized opt-out suppression list.
4. Provide a verified booking URL only if founder scheduling is desired.
5. Re-run research after the gates pass; retain only candidates with a public professional contact route, then schedule each eligible first touch in the recipient’s local weekday 09:30–11:30 window.
