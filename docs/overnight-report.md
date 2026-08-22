# Unvibe overnight report — 2026-07-16

This report covers one bounded `repository-health` night-lab mission. It does not present prior
mock or credential-free work as production verification.

## 1. Starting branch

`codex/design-pixel-launch-experiment`, tracking the same branch on `origin`.

## 2. Ending branch

`codex/design-pixel-launch-experiment`. No merge, force-push, main-branch push, or branch switch.

## 3. Initial audit summary

All package trees installed reproducibly and the existing test/build baseline was green. The
main actionable defect was deployment documentation that no longer matched the active waitlist
storage and notification implementation. A second related mismatch pointed canonical metadata
and the desktop privacy action at `unvibe.app` instead of the approved `unvibe.site` host.

## 4. Critical bugs found

None in the credential-free build/runtime paths. Cloud and provider verification blockers remain
high impact but were not mislabeled as confirmed defects.

## 5. Critical bugs fixed

No Critical-class item was found. Two High-impact deployment-readiness defects were fixed:

- production waitlist configuration now documents the Vercel Blob/admin-secret/Resend contract;
- marketing canonical URLs and the desktop privacy link now target `https://unvibe.site`.

## 6. Website redesign changes

No visual redesign was performed in this repository-health mission. The existing pixel-learning
design was preserved. Deployment guidance and canonical metadata were corrected.

## 7. Spacing improvements

Not changed in this mission. Requires a visual design/accessibility mission rather than source-only
claims.

## 8. Mobile improvements

Not changed in this mission. The six-width screenshot matrix was not rerun.

## 9. Backend improvements

No backend code changed. Status: **Working and tested locally** for the memory-backed API path.
The aggregate local smoke passed sign-in, event write, paged restore, deletion, and old-token
invalidation. Supabase behavior remains **Blocked** pending staging credentials.

## 10. Authentication improvements

No auth code changed. Status: **Implemented but not fully tested**. Session revocation, expiry,
device-code idempotency/expiry, and local API deletion passed. Real email/provider verification,
refresh, browser-to-desktop callback, and cross-device cloud persistence remain unverified.

## 11. Streak implementation status

**Implemented but not fully tested.** Local and server tests pass for consecutive-day logic,
captured local dates, timezone boundaries, and cautious event-derived progress. Real offline
reconnect, DST, timezone changes, deletion effects, and multi-device updates still require staging
evidence.

## 12. Skills implementation status

**Implemented but not fully tested.** Stable normalized skill identity, cautious evidence states,
and “latest confusion wins” behavior pass locally. The additive Supabase model exists but has not
been applied or verified in staging during this run.

## 13. Progress-page status

**Implemented but not fully tested.** Profile/streak/skill derivation tests are green and avoid
single-answer mastery claims. No new browser or offline-state visual verification was performed.

## 14. Pro subscription status

**Implemented but not fully tested.** The existing Free/Pro/Teams model, server entitlements,
roles, invitations, limits, grace behavior, checkout-intent expiry, and downgrade preservation
passed local tests. No billing code was changed in this mission.

## 15. Billing test-mode status

**Blocked by non-production Stripe and Supabase configuration.** Checkout remains disabled without
trusted test keys, price IDs, and webhook secret. No product, price, payment link, charge, or live
credential was created.

## 16. Sync improvements

No sync code changed. Status: **Working and tested locally** for retry math, remote merge,
newer-local outbox preservation, paged restore, and local API deletion/token invalidation.
Cross-device Supabase sync remains **Blocked**.

## 17. Privacy and security fixes

The environment template now correctly marks storage, encryption/admin, and email credentials as
server-only. The existing encrypted waitlist payload and exact bearer-token authorization tests
remain green. Repository safety and secret-pattern checks passed. No secrets or ignored environment
files were staged.

## 18. Performance improvements

No speculative optimization was made. Builds completed successfully. Marketing reports a 77.8 kB
home route and 183 kB first-load JavaScript; the dashboard plan route is 3.87 kB with 91.2 kB
first-load JavaScript. Runtime profiling was not performed.

## 19. Accessibility improvements

No accessibility code changed. Marketing lint/build passed, but keyboard, VoiceOver, contrast,
reduced-motion, and automated axe evidence were not rerun in this mission.

## 20. Tests run

- `npm ci` in `app`, `extension`, `marketing`, `server`, and `web`.
- Typecheck in all five packages.
- Tests in app, extension, marketing, and web.
- Builds in app, extension, marketing, and web.
- Marketing lint.
- Dependency audits in app, extension, marketing, server, and web.
- Root `npm run verify:beta` aggregate gate.

## 21. Tests passed

- App: 19/19.
- Extension: 34/34.
- Marketing: 11/11.
- Web: 32/32.
- Total: 96/96 tests.
- Aggregate verifier: 22/22 checks, including local API smoke, unsigned staging package, and
  package verification.

## 22. Tests failed

No final failures. Two intermediate verification issues were fixed or rerun:

- the new environment-doc test initially used iteration unsupported by the current TS target;
- a marketing typecheck raced a concurrent `next build` over `.next/types`; standalone typecheck
  passed immediately afterward.

The marketing build retains one non-fatal edge-runtime/static-generation warning. The intentional
FormSubmit failure test logs an error stack but passes and records delivery as failed.

## 23. Commits created

- `fix(marketing): document durable waitlist setup`
- `fix(marketing): align canonical production domain`
- This report/audit checkpoint is committed after report rendering; its SHA is available in the
  final task handoff because a commit cannot include its own SHA.

## 24. Commit SHAs

- `d7a1fe7` — durable waitlist deployment configuration and regression test.
- `145169a` — `unvibe.site` canonical metadata and desktop privacy link.

## 25. Push status

Both code checkpoints were pushed successfully to
`origin/codex/design-pixel-launch-experiment`. The existing draft PR is
[#5](https://github.com/ShadowEsu/Unvibe/pull/5), targeting `codex/beta-core`.

## 26. Deployment status

**Not deployed.** The night-lab workflow forbids deployment/publishing. `unvibe.site` production
visibility and hosted waitlist delivery were not claimed as verified.

## 27. Remaining blockers

- Disposable staging Supabase project and guarded environment.
- Real non-production AI provider key and spend limit.
- Stripe test secret, four test Price IDs, webhook secret, and product approval.
- Vercel Blob/admin secret plus verified Resend sender or activated FormSubmit.
- Apple signing/notarization credentials and physical macOS QA.
- Approved legal copy, support contact, and final product naming.
- Controlled Next.js/Electron dependency upgrades.

## 28. Required credentials

Only non-production values should be supplied: staging Supabase URL/anon/service-role keys, a
non-production AI provider key, Stripe test keys/price IDs/webhook secret, Vercel Blob token,
waitlist admin secret, verified email provider credential, and later Apple signing/notary values.
None should be pasted into source control or client-rendered code.

## 29. Founder decisions needed

- Final public name: Unvibe or Uncode.
- Approved staging and production domains and deployment branch.
- Whether/when to accept major Next.js and Electron upgrades.
- Identity provider and recovery/verification experience.
- Approved pricing/legal/cancellation copy before billing activation.
- Verified support and sender email domains.

## 30. Highest-priority next steps

1. Configure a disposable marketing preview with Vercel Blob and Resend, then prove one signup,
   admin read, notification, retry, and duplicate path.
2. Run guarded Supabase RLS, deletion, persistence, offline/reconnect, and two-client tests.
3. Run Stripe test-mode checkout/webhook/portal/cancel/downgrade against staging only.
4. Complete the six-width marketing screenshot and accessibility matrix.
5. Plan controlled Next.js and Electron upgrades on isolated branches before release.

No production data was changed, no billing was enabled, no real charge was attempted, and no legal
language was approved.
