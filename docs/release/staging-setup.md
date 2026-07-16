# Staging setup

Owner: founder or authorized infrastructure operator. Do not reuse production projects, domains, keys, user data, billing, or AI credentials.

## Isolated resources

1. Create a new Supabase project whose ref is not the production ref. Record region and project ref.
2. Apply `web/supabase/migrations/0001_init.sql` through `0007_skills_and_history_pagination.sql` in order using the Supabase CLI migration workflow. Save CLI output and the migration history table result.
3. Create a staging Vercel project linked only to that Supabase project. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and public auth settings in the staging scope only.
4. Leave `ANTHROPIC_API_KEY`, Stripe, and Apple variables absent for the first pass. The mock AI path is the credential-free gate.
5. Copy `.env.staging.example` to a secure ignored location and fill staging-only values. Never paste it into an issue, chat, log, or commit.
6. Set `STAGING_ALLOW_DESTRUCTIVE_TESTS=true` only for a disposable test window, then run `npm run verify:staging` from the repository root.

## Guard behavior

The verifier refuses non-HTTPS endpoints, an unapproved Supabase host, mismatched project refs, equal staging/production refs, equal staging/production web origins, `APP_ENV` other than `staging`, a live Stripe key, or missing explicit confirmation. It prints test results, never secret values.

## Required evidence

- Commit SHA and deployment URL.
- Applied migration list through `0007`.
- Full `verify:staging` JSON output with both disposable suites passing.
- Supabase Auth users and custom user rows returning to their pre-test counts.
- Deployment logs showing no fallback to MemoryStore.

Failure of any item blocks beta promotion. Do not point the packaged app at staging until the mock-provider staging gate is green.
