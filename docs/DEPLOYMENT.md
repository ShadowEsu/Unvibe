# Deployment

Desktop: `cd app && npm run build && npm test && npm run typecheck`. Package with `npm run dist:mac` after bridge prep.

Backend: `cd web && npm run build && npm test && npm run typecheck`. Apply additive Supabase migrations in `web/supabase/migrations/`. Newest knowledge tables: `20260919010000_knowledge_objects.sql`.

Required server secrets stay in `web/.env` / Vercel: provider keys, Supabase service role, optional `UNVIBE_TRIAL_TOKEN`. Never bake provider API keys into the Electron binary.

Marketing (`marketing/`) is a separate site.
