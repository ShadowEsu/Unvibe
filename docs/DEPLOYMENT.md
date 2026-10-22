# Deployment

Desktop: `cd app && npm run build && npm test && npm run typecheck`. Package with `npm run dist:mac` after bridge prep.

Backend: `cd web && npm run build && npm test && npm run typecheck`. Apply additive Supabase migrations in `web/supabase/migrations/`. Newest knowledge tables: `20260919010000_knowledge_objects.sql`.

Required server secrets stay in `web/.env` / Vercel: provider keys, Supabase service role, optional `UNVIBE_TRIAL_TOKEN`. Never bake provider API keys into the Electron binary.

Trial spend limits (server env, all optional; unset or invalid means the default). Periods are UTC, and every trial AI request (explanation, follow-up, Test me) counts towards the per-IP, monthly and daily caps:
- `UNVIBE_TRIAL_EXPLANATION_LIMIT` (50) and `UNVIBE_TRIAL_FOLLOW_UP_LIMIT` (50): per install, for its 30 days.
- `UNVIBE_TRIAL_IP_DAILY_LIMIT` (150): per network per day. A network is an IPv4 address or an IPv6 /64, and IPv4-mapped IPv6 counts as the IPv4. The counter is keyed by an HMAC of the network (`TRY_IP_SALT`, else the service-role key), never the raw IP.
- `UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT` (50,000): all installs per month, counter `__global__:YYYY-MM`.
- `UNVIBE_TRIAL_GLOBAL_DAILY_LIMIT` (2,000): all installs per day, counter `__global_day__:YYYY-MM-DD`.

If a trial counter cannot be reserved, the request is refused with 503. Follow-up questions over 4,000 characters get 413. No code reads `UNVIBE_TRIAL_GLOBAL_LIMIT` (replaced by the monthly limit), `UNVIBE_TRIAL_MONTHLY_LIMIT` or `UNVIBE_TRIAL_QUIZ_LIMIT`.

Marketing (`marketing/`) is a separate site.
