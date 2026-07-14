# Environment setup

This is a deployment checklist, not a credential file. Keep secrets in the hosting provider's
secret store or an untracked `web/.env.local`; never put them in `app/` or renderer code.

| Variable | Required | Owner | Safe in desktop client | Development / missing behavior |
|---|---|---|---|---|
| `APP_ENV` | yes for deploys | web/app | diagnostic only | `development`; staging/prod must be explicit |
| `UNVIBE_BACKEND` | cloud features | app main process | origin only | local `http://localhost:8787`; no cloud features if unreachable |
| `WEB_BASE_URL` | device flow | web | no | local origin in dev |
| `SUPABASE_URL` | staging/prod | web | no | memory store is development-only |
| `SUPABASE_SERVICE_ROLE_KEY` | staging/prod | web | **never** | backend-only database access |
| `SUPABASE_ANON_KEY` | future direct Supabase client | web | only if intentionally public | currently unused; do not add to renderer |
| `ANTHROPIC_API_KEY` | real AI | web | **never** | labelled mock AI only in development |
| `UNCODE_MODEL` | optional | web | no | defaults in provider |
| `AI_REQUEST_TIMEOUT_MS` / `AI_MAX_TOKENS` | optional | web | no | provider defaults |
| `ENABLE_MOCK_AI` | dev only | web | no | must be false for staging/prod |
| `UNCODE_ALLOW_DEV_EMAIL_AUTH` | dev only | web | no | false; never enable outside local development |
| `DEEP_LINK_SCHEME` | future verified callback | app | scheme only | `unvibe` |

## Staging setup

1. Create a separate Supabase project and apply `web/supabase/migrations/0001_init.sql`.
2. Set `APP_ENV=staging`, HTTPS `WEB_BASE_URL`, `SUPABASE_URL`, and the service-role key in the
   web host's secret store.
3. Set a real Anthropic key and set `ENABLE_MOCK_AI=false`.
4. Package the app with `UNVIBE_BACKEND=https://<staging-host>` available to the **main process**.
5. Do not enable `UNCODE_ALLOW_DEV_EMAIL_AUTH`; complete the verified device-auth implementation
   before inviting testers.

Do not place a service-role key or Anthropic key in `app/.env`, preload code, or any renderer.
