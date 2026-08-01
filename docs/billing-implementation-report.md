# Free, Pro, and Teams implementation report

Date: 2026-07-16
Branch: `codex/design-pixel-launch-experiment`

## Outcome

Uncode/Unvibe now has a server-authoritative Free, Pro, and Teams architecture across the Next.js
backend/dashboard, Electron companion, and public marketing site. This work does **not** enable
production billing, create Stripe products, make a charge, apply the Supabase migration to a
remote project, or approve legal language.

## Implemented

- Central plan definitions and limits: Free 30 explanations/1 project/25 dictionary/20 saved;
  Pro 1,000 explanations/10 projects; Teams usage scales by purchased seats.
- Exact price math: Pro $8/month or $72/year with 25% annual savings; Teams plan math retained
  server-side but not offered in current product surfaces.
- Personal and team workspaces, owner/admin/member roles, separate member identities, secure
  hashed invitations, invitation expiry/revocation, and pending-invite seat reservation.
- Server-only Stripe Checkout, Customer Portal, quantity updates with prorations, signed raw-body
  webhooks, direct provider reconciliation, trusted price validation, duplicate-checkout guards,
  provider-event idempotency/retry, cancellation, and bounded failed-payment grace.
- Atomic monthly usage reservations before real AI explanation and project-question requests.
  Limit responses preserve saved data and point to Plan & usage.
- Additive Supabase migration with existing-user Free backfill, workspace association for existing
  learning data, constraints, indexes, RLS, explicit grants, configurable entitlement rows, audit
  records, and server-only RPC execution.
- Signed-in web Plan & usage page, workspace switcher, monthly/annual cards, Portal access, seat
  totals, team members, roles, invitations, revocation, and checkout-disabled state.
- Electron Plan & usage page with all networking kept in the main process.
- Public three-card pricing section, responsive toggle, exact totals, accurate FAQs, and
  privacy-minimized enumerated analytics.
- Auth navigation refresh fix after sign-in/sign-up and a 390px mobile navigation fix.

## Database migration

Added:

- `web/supabase/migrations/20260716092442_plans_workspaces_billing.sql`

It is additive and must be applied to staging before the billing routes are enabled. Existing
users remain Free. No legacy paid plan was present in the inspected schema, so no paid mapping or
charge change was performed.

## Required server environment

- `PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`
- `STRIPE_PRICE_TEAMS_MONTHLY`
- `STRIPE_PRICE_TEAMS_ANNUAL`
- `BILLING_GRACE_PERIOD_DAYS` (defaults to 7)

The four Stripe Prices must be recurring USD prices with the amounts and intervals above. Teams
Prices use licensed quantity. Full setup and event subscriptions are in `docs/billing.md`.

## Automated verification

- Backend/dashboard: 32/32 tests passed; strict typecheck passed; production build passed.
- Marketing: 10/10 tests passed; strict typecheck passed; production build passed.
- Electron app: 19/19 tests passed; strict typecheck passed; production build passed.
- `git diff --check`: passed.
- Exact totals confirmed in tests: $8/month, $72/year, $16/$40 monthly Teams totals at 2/5 seats,
  and $144/$360 annual Teams totals at 2/5 seats.
- Covered: Free/Pro/Teams entitlements, seat minimums, invite reservation, roles, unauthorized
  access, workspace separation, activation/cancellation/downgrade preservation, failed-payment
  grace, trusted price selection, price/quantity tampering, webhook retry/idempotency, stale and
  duplicate checkout protection, existing-user Free migration behavior, and provider-ID redaction.

## Manual browser verification

Using isolated memory storage, mock AI, dev email auth, and blank Stripe variables:

- Marketing desktop: page content, no error overlay, no captured console errors, all three pricing
  cards, monthly/annual toggle, Pro $72/year with 25% savings, Teams checkout hidden from surfaces
  with 25% savings.
- Dashboard desktop: sign-up, authenticated navigation, Free personal workspace, all five usage
  lines and resets, monthly/annual prices, two-seat Teams minimum, and honest disabled-checkout state.
- Marketing and dashboard at 390×844: no horizontal overflow, no error overlay, empty console-error
  capture, stacked pricing cards, and usable signed-in mobile navigation.

## Files changed

### Root and documentation

- `README.md`
- `docs/billing.md`
- `docs/billing-implementation-report.md`
- `docs/privacy.md`
- `docs/legal/subscription-cancellation-policy.md`
- `docs/product/pro-plan-decision.md`
- `docs/release/known-limitations.md`
- `docs/release/rls-test-matrix.md`

### Electron app

- `app/src/main/backend.ts`
- `app/src/main/main.ts`
- `app/src/preload/preload.ts`
- `app/src/renderer/companion/companion.tsx`
- `app/src/renderer/companion/companion.css`

### Marketing

- `marketing/src/components/redesign/PricingPlans.tsx`
- `marketing/src/app/page.tsx`
- `marketing/src/app/layout.tsx`
- `marketing/src/app/globals.css`
- `marketing/src/data/faq.ts`
- `marketing/src/lib/analytics.ts`

### Backend and dashboard

- `web/.env.example`
- `web/package.json`
- `web/package-lock.json`
- `web/src/lib/auth.ts`
- `web/src/data/supabaseStore.ts`
- `web/src/billing/{types,plans,store,memoryBillingStore,supabaseBillingStore,stripe,http,enforce,webhooks,presentation}.ts`
- `web/app/layout.tsx`
- `web/app/globals.css`
- `web/app/login/page.tsx`
- `web/app/signup/page.tsx`
- `web/app/plan/{page,PlanManager}.tsx`
- `web/app/invite/[token]/{page,InviteAccept}.tsx`
- `web/app/api/v1/account/route.ts`
- `web/app/api/v1/{reviews,comprehension}/route.ts`
- `web/app/api/v1/billing/{overview,checkout,refresh,portal,seats,event,webhook}/route.ts`
- `web/app/api/v1/workspaces/route.ts`
- `web/app/api/v1/workspaces/[workspaceId]/{invitations,members}/route.ts`
- `web/app/api/v1/workspaces/[workspaceId]/invitations/[invitationId]/route.ts`
- `web/app/api/v1/workspaces/[workspaceId]/members/[memberUserId]/route.ts`
- `web/app/api/v1/workspaces/invitations/accept/route.ts`
- `web/supabase/migrations/20260716092442_plans_workspaces_billing.sql`
- `web/test/billing.test.ts`

## Remaining provider/dashboard steps

1. Approve the legal subscription, cancellation, refund, retention, tax, and jurisdiction language.
2. Create the four recurring Stripe test-mode Prices and configure Customer Portal behavior.
3. Apply the migration to a disposable/staging Supabase project and run RLS/user-isolation,
   deletion, invite, and migration rollback/recovery checks.
4. Configure the Stripe test webhook and exercise signed deliveries, test cards, test clocks,
   invoices, failed payments, recovery, cancellation, reactivation, and seat proration.
5. Review the existing Next.js 14 high-severity audit advisory. The automated fix requires a
   breaking Next 16/React migration and was intentionally not force-applied without sign-off.
6. Only after those gates pass, make a separate explicit decision about live-mode billing.

The Supabase CLI migration lint command was attempted but could not connect because this machine
had no running local Docker/Postgres service. No staging or production database was contacted.
