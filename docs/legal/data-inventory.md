# Data inventory — engineering draft

| Data | Example fields | Purpose | Location | Sensitivity / notes |
| --- | --- | --- | --- | --- |
| Selected/context code | source snippet, diff, project summary | Generate explanation | Memory in desktop/backend/provider request | Confidential source; locally filtered; not intentionally persisted in learning tables |
| Learning event | UUID, time/local date/timezone, scope, level, outcome, concept, project/file, lines, language, source app | History, streak, sync, evidence | Local JSON; Supabase `events` | File/project labels may reveal confidential metadata |
| Skill summary | normalized/display name, counts, evidence state, dates, related projects/event IDs | Cautious progress summary | Supabase `skills`; derived in memory | Not proof of mastery; migration unverified in staging |
| Account | internal UUID, email, settings/level | Identity/preferences | Supabase `users`; local account record | Personal data |
| Session/device auth | opaque UUID token, expiry, device/user code, approval/redemption times | Authentication | Supabase `tokens`/`device_codes`; encrypted local token | Secret; never log or expose to renderer |
| Consent history | internal user ID, repository label, action, time | Per-repository cloud consent record | Supabase `consent_log` | Repository value may be identifying; current UI completeness requires verification |
| Provider request | filtered code/context, level, instructions, request ID | AI inference | Backend transient memory/provider | Provider retention/use must be contractually confirmed |
| Operational metadata | operation, status class, duration/count, app version | Reliability/support | Hosting logs if configured | Exact runtime configuration/retention not set |
| Waitlist | first/last name, email, tool | Private-beta contact | Marketing Supabase table | Personal/contact data; separate marketing project/config |

Excluded from approved logs: source/diffs/prompts/explanations, credentials, tokens/cookies, email, repository/file names, environment values, and secret-filter matches.
