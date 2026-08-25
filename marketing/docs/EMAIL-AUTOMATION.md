# CMO email automation — Unvibe marketing

System of record for outbound product marketing mail is **Resend** (`RESEND_API_KEY`, `WAITLIST_FROM_EMAIL`). AgentMail/Gmail MCPs are for ad-hoc founder replies only, not production automation.

## Live today

| Email | Trigger | Code |
|-------|---------|------|
| Founder alert | New waitlist signup | `src/lib/notifyWaitlist.ts` |
| **Waitlist confirmation** (to user) | New waitlist signup | `src/lib/notifyWaitlistConfirmation.ts` + `src/emails/waitlistConfirmation.ts` |
| Beta invite | Human CLI `--send` | `scripts/send-beta-invites.ts` + `src/emails/betaInvite.ts` |

Signup path: `POST /api/waitlist` → save → founder notify → waitlister confirmation. Status fields: `notification`, `confirmation` / `confirmationAt`, `betaInviteAt`.

## Ready drafts (not auto-sent)

`src/emails/lifecycleDrafts.ts` — day-3 check-in, Accessibility help, survey reminder, referral confirm. Wire only with triggers + principal approval.

## Authority

- Transactional confirmation: auto after copy approved (shipped).
- Beta invite batches: dry-run then human `--send` every time.
- Referral rewards / cash claims: human verify before any confirm email.
- Accessibility help: only with a real stuck signal, or send manually.

## Env

See `marketing/.env.example`: `RESEND_API_KEY`, `WAITLIST_FROM_EMAIL`, Blob + admin token for durable list.

## Next slices (priority)

1. Admin “resend confirmation” for failed `confirmation.status === failed`
2. Keep invite CLI; optional admin button that only queues dry-run preview
3. Day-3 cron after `betaInviteAt` (needs scheduler)
4. Product event → Accessibility help (needs desktop instrumentation)
