# Account, billing, and GitHub implementation status

As of 2026-09-22 this is an **in-progress** integration pass. See `ACCOUNT_INTEGRATION_AUDIT.md` for the source map, `EXTERNAL_SETUP_REQUIRED.md` for provider actions, and `INTEGRATION_E2E_TEST.md` for the acceptance matrix.

## Implemented in this pass

- The production Supabase store now uses its existing row-locking, one-time approval/redemption RPCs and enforces the 30-day session expiry column. Database failures no longer masquerade as unknown codes or anonymous sessions. Device user codes now have 64 bits of randomness; already-issued eight-character codes remain redeemable until expiry. The browser performs the Google PKCE code exchange once instead of combining automatic and manual exchange.
- The browser's opaque session cookie is capped at the same 30 days as the server session. The desktop still seals its bearer token with Electron `safeStorage`; no Google or Stripe key is moved into the renderer.
- Checkout success polling reads only webhook-confirmed entitlements, waiting up to 30 seconds before presenting a truthful pending state. A browser redirect cannot write a subscription. Lifetime purchases require paid status, including the asynchronous-success event. The webhook can attach its server-created checkout intent even if it arrives before the Checkout API response. Checkout reuses a known Stripe customer after cancellation, and an active subscription blocks another lifetime purchase.
- Local tests cover persistent-store replay/failure and delayed lifetime payment. The existing Google browser flow, desktop device polling, signed webhook, Portal, and usage reservation remain intact. No app layout, marketing page, image, color, or widget was changed.

## Verification

`web` strict typecheck, 50 unit tests, and Next.js production build passed locally. Real Supabase migrations/provider login, Stripe test-mode webhook/payment, packaged desktop restart, RLS isolation, and GitHub connection have **not** been exercised here. Keep the release gate closed until the E2E matrix passes.

## Not implemented yet

GitHub App connectivity, installation/repository selection, disconnect/revocation, and remote repository context are absent. The app's existing GitHub Desktop detection is local integration discovery only. A new GitHub App is a major architecture change requiring the decision and sign-off described in the audit. Desktop account state consolidation and live provider verification also remain.

No migration was added in this pass: the required atomic device and session-expiry migrations already exist. Deploy them before deploying the changed server code. Roll back code together with schema compatibility if staging detects a mismatch; do not drop the additive columns or existing user data.
