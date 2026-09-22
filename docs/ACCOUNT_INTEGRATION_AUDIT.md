# Account integration audit — 2026-09-22

Scope: the newer desktop app in this repository (`app/`), its `web/` API, and its existing Supabase migrations. Marketing and the older parent checkout are outside scope. This is an implementation audit, not a claim of a live production integration.

| Area | Current path | Finding / release gate |
| --- | --- | --- |
| Identity | `web/app/activate/page.tsx` uses Supabase Google OAuth (PKCE); `/api/v1/auth/approve` verifies the Supabase access token with `auth.getUser`. | Provider and redirect allow-list require verification in the actual Supabase project. Direct email-only auth routes are development-only by default. |
| Desktop handoff | Main process starts `/auth/device`, opens `/activate?user_code=…`, polls `/auth/token`, and seals the opaque token with Electron `safeStorage`. | The production store had not used its existing one-time transactional RPCs. Fixed in this pass. Session expiry now checked by the server. No protocol callback is required for this device flow; the device code is the handoff secret. |
| Account | `GET /api/v1/account` validates the opaque token; local learning is separately stored. | The renderer has a cached account display and does not distinguish offline from an expired remote session at every entry point. Account-state consolidation remains. |
| Billing | Backend Checkout/Portal routes, Stripe price IDs, signed webhook, billing store, usage RPC, and dashboard/desktop plan views exist. | Redirect-based `/billing/refresh` formerly wrote entitlements; fixed to wait for webhook. Customer reuse and delayed lifetime payment handling fixed. Live price/portal/webhook configuration and database behavior are unverified. |
| GitHub | `app/src/main/integrations.ts` detects GitHub Desktop; local Git diff/blame/log features work without a remote account. | No GitHub App, server installation state, selected repository store, webhooks, or connected-account UI. The current integration label must not be mistaken for cloud GitHub access. See design decision below. |
| Data security | RLS enabled on app tables; server uses service-role for trusted operations; billing RPCs have restricted execute grants. | Run the staging RLS and deletion suites against a real disposable project. Code review alone cannot prove deployed schema/policies match these files. |

The highest-priority changes in this pass are confined to existing architecture: `SupabaseStore` now calls `approve_device_code` and `redeem_device_code` atomically, checks session expiry and database failures, and issues 64-bit user codes while preserving existing pending codes. Checkout return is read-only. The signed webhook remains the only path that completes an intent and grants the paid subscription. Lifetime access waits for a paid Checkout session. Stripe customers are reused when an existing workspace subscription retains its provider ID.

## GitHub architecture decision requiring sign-off

**Decision proposed:** add a server-side GitHub App, additive tables for installations/selected repositories and short-lived connection state, a signed installation webhook, and a main-process-only desktop API. Keep local Git independent. Request only repository metadata plus read-only contents if a specific opted-in feature requires remote content; never mirror repository bodies by default.

**Why:** a GitHub Desktop presence check cannot identify an authorized installation or repository selection. A GitHub App can scope access to selected repositories and use short-lived installation tokens.

**Alternatives:** an OAuth App or personal access token is simpler to prototype but broadens token handling and does not give the same installation/repository permission model; local Git only preserves privacy but cannot provide the requested cloud connection.

**Tradeoffs:** new third-party permissions, server-side key custody, webhook verification, installation ownership/consent mapping, database schema and revocation semantics, plus operational setup. This is a major architecture addition under `AGENTS.md` change control. It has not been implemented or presented as connected.

## Remaining work, in order

1. Apply and validate the existing migrations (especially `0004_session_expiry.sql` and `0006_atomic_device_flow.sql`) on disposable staging; run real Google device approval, replay/expiry/restart/revocation and user isolation.
2. Test Stripe test-mode checkout, signed webhook and Portal against staging. Check monthly/annual/lifetime prices and customer reuse, cancellation, failed invoice and asynchronous payment.
3. Consolidate desktop account/session state with explicit loading, authenticated, anonymous, expired and offline handling while preserving local knowledge and widget behavior.
4. After GitHub App architecture sign-off, implement installation/callback/webhook/repository selection/disconnect and E2E tests with a dedicated test installation.
5. Re-run the packaged desktop and deployed backend matrix in `INTEGRATION_E2E_TEST.md` before production rollout.

Current local verification: web typecheck, tests, and production build pass. No real Supabase, Stripe, or GitHub account was connected by those checks.
