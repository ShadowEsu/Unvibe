# External setup required

The application cannot create or inspect provider credentials in a founder-owned account without that account's authorization. Values stay in the deployment secret manager and ignored local environment files, never Git, renderer code, screenshots, or support logs. Start with isolated **test/staging** projects; do not charge a live card to validate this pass.

## Supabase + Google

1. Create/identify the intended staging Supabase project. The repo has `web/supabase/migrations/` but no `web/supabase/config.toml`; initialize Supabase CLI locally from `web/` (`supabase init`) if needed. Review the migration list, run `supabase link --project-ref <staging-ref>`, compare `supabase migration list`, then `supabase db push` against **staging only**. Check the actual applied migration history before and after; do not reapply SQL by hand if the project has already been migrated outside CLI. In particular verify `0004_session_expiry.sql` and `0006_atomic_device_flow.sql` are present. Back up the database first; migration `20260908120000_lifetime_interval.sql` replaces a check constraint, so review it before applying. Never point this command at production without staging results.
2. Enable Google under Supabase Authentication → Providers. In Google Cloud, configure the OAuth client and authorize `https://<project-ref>.supabase.co/auth/v1/callback` as a redirect URI; store the client ID/secret in Supabase's provider settings.
3. Add `https://<actual-backend-origin>/activate` to Supabase Auth redirect allow-list; add `http://localhost:8787/activate` to the development project only. Configure the site URL for the matching environment.
4. Server secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; web public build values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep `UNCODE_ALLOW_DEV_EMAIL_AUTH=false`, `UNCODE_ALLOW_MEMORY_STORE` unset, and `ENABLE_MOCK_AI=false` in production. `SUPABASE_ANON_KEY` is public; service-role is not.
5. Verify a real Google user has the same Supabase UUID in `auth.users` and the app's `public.users` after approval. Execute staging RLS/deletion checks, then a packaged desktop restart and revoked-session check.

## Stripe

1. Create/confirm the actual test-mode Prices corresponding to `web/src/billing/plans.ts`: Pro monthly $10, annual $90, optional lifetime one-time $80. Confirm currency, recurrence, tax and legal copy before enabling; do not copy historical prices from older docs. Teams checkout is currently disabled.
2. Set backend-only `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, optionally `STRIPE_PRICE_PRO_LIFETIME`, and HTTPS `APP_URL` (the backend/dashboard origin). Configure Customer Portal for the supported cancellation/payment-method behavior.
3. Set signed webhook endpoint `https://<actual-backend-origin>/api/v1/billing/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, and `invoice.paid`. Use the webhook signing secret for this exact endpoint and environment.
4. Verify a test checkout creates a single customer, the webhook completes the intent and grants Pro, a second checkout reuses the customer after cancellation, and the Portal reflects server state. A success URL alone must leave the account pending. Do not switch to live keys until legal, taxes, refunds, pricing and test evidence are approved.

## GitHub App — proposed, not configured or connected

No GitHub App backend exists yet, so **do not create secrets and assume GitHub is live**. The proposed configuration after architecture approval is: a GitHub App owned by the correct organization, installation callback on the backend HTTPS origin, signed webhook endpoint, repository metadata and narrowly justified read-only contents permissions, selected-repository installation, and a test account/organization. The private key and webhook secret would be server-only; installation tokens would be short-lived, never stored in Electron. Exact callback paths and variable names will be documented when implemented.

## URLs and deployment

`PUBLIC_APP_URL` must be the backend/dashboard origin, not the marketing site. `UNVIBE_RELEASE_BACKEND` is baked into a packaged app at build time; use the same backend environment whose Supabase and Stripe settings were tested. Confirm production builds do not resolve to localhost. Provider configuration and credentials on this workstation have not been verified; local `web/.env.local`, `web/.env`, and `app/.env` were absent at audit time.

The connected Supabase account exposed only a project named `Regrade-waitlist`, which is not identifiable as Unvibe. No Unvibe database migration or provider setting was changed there. The local `.vercel/project.json` names `unvibe-site`, but that project was not present in the connected Vercel project list; deployment access and its environment remain unverified.
