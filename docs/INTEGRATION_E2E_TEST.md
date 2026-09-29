# Account and billing E2E test matrix

Run in a disposable staging environment with the matching packaged desktop, deployed backend, staging Supabase, and **Stripe test mode**. Record build SHA, backend origin, migration list, provider event IDs (never tokens), test result and date. See `EXTERNAL_SETUP_REQUIRED.md` for provider setup.

## Credential-free gate

```sh
cd web && npm run typecheck && npm test && npm run build
cd ../app && npm run typecheck && npm test && npm run build
git diff --check
```

These validate code, not live provider configuration. Run `npm run test:rls:staging` and `npm run test:deletion:staging` in `web/` only with the explicit disposable-project guard variables documented in `docs/release/staging-setup.md`; inspect their output and do not run destructive suites against production.

## Google and desktop

1. Start unsigned and verify local learning remains usable. Select Continue with Google; browser opens the correct HTTPS `/activate` and displays the same 16-character code as the app. Complete Google sign-in and approve. Desktop receives an account once; backend UUID matches Supabase Auth UUID.
2. Retry approval and device redemption, try an expired code, a malformed code, and a different Google account. A redeemed/expired code must not issue another token; a different account must not take over approval.
3. Quit and reopen the packaged app; cloud account and local knowledge persist. Revoke the opaque session and verify cloud actions request sign-in while local learning remains. Test offline launch and reconnection separately. Sign out and check remote revocation and local secret removal.
4. Test cold-start/already-running behavior of the browser device flow. The `unvibe://` scheme is used for review links, not to carry an OAuth token in the current auth design.

## Stripe

1. Signed-in Free user opens monthly/annual Checkout. Cancel without paying: Free remains. Forged success URL or another user's session ID must not activate Pro.
2. Complete payment with a Stripe **test card**. Before webhook delivery, `/billing/refresh` returns pending. Deliver `checkout.session.completed` with the valid signature; the plan becomes Pro and usage limits change. Replay the same event and verify no second entitlement/usage mutation. Invalid signature returns 400.
3. Repeat with a delayed one-time lifetime payment: `checkout.session.completed` while unpaid does not grant Pro; `checkout.session.async_payment_succeeded` when paid does. Check the trusted lifetime Price ID.
4. Open Customer Portal as owner, update payment method, cancel at period end, trigger failed invoice/grace/expiry/recovery and verify server-authoritative plan transitions. Verify another user cannot open this customer's Portal. Check a later purchase reuses the Stripe customer ID.
5. Verify server quota enforcement under parallel requests, reset boundaries, and retained learning across downgrade. Use Stripe test clocks where appropriate; never use live charges for this test.

## GitHub — pending implementation

After GitHub App approval and implementation: connect test installation, select only permitted repos, verify ownership and signed callback/webhook state, match a local remote without uploading local code, change selected repo access, uninstall/disconnect, restart, and verify no stale access. Until then local Git diff/blame/log must work without GitHub login. Mark this section **not run**, not passed.

Release gate: complete all applicable provider tests on the real staging backend, capture evidence, and only then consider production configuration. Current local automated checks cannot certify this E2E matrix.
