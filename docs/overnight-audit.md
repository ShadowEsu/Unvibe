# Unvibe overnight audit — 2026-07-16

## Scope and evidence

This was a single-agent `repository-health` mission on
`codex/design-pixel-launch-experiment`. It inspected the repository instructions, package
scripts, environment templates, migrations, deployment documentation, tests, recent Git
history, and unfinished-code markers. It installed every package from its lockfile, ran the
available typechecks, tests, lint, builds, dependency audits, and the root beta verifier.

No production endpoint, production database, paid AI provider, live billing account, Apple
credential, or signing identity was used. Ignored `.env` files were not printed or committed.

## Findings

No credential-free critical build or runtime failure remains. The highest-impact defect found
in this mission was a production waitlist deployment contract that no longer matched the code.

| ID | Severity | Issue | Affected files | User impact | Recommended fix / status | Tests needed |
| --- | --- | --- | --- | --- | --- | --- |
| WAITLIST-01 | High impact | Deployment docs still prescribed Supabase although the active adapter requires Vercel Blob, an admin/encryption secret, and optional Resend. | `README.md`, `marketing/.env.example`, `marketing/README.md`, `marketing/src/lib/waitlistStore.ts` | A correctly followed deployment guide would leave durable storage unconfigured and production signups would fail closed. | **Fixed and tested** in `d7a1fe7`; every marketing environment reference is now checked against the template. | Disposable hosted signup, admin read, and delivery confirmation with non-production credentials. |
| DOMAIN-01 | High impact | Metadata, sitemap, robots, JSON-LD, and the desktop privacy link defaulted to `unvibe.app` while the approved website and email flows use `unvibe.site`. | `marketing/src/app/*`, `marketing/src/components/JsonLd.tsx`, `app/src/main/main.ts` | Search/social metadata and the desktop privacy action could point at the wrong host. | **Fixed and tested** in `145169a`; the canonical default is now `https://unvibe.site`. | Verify deployed canonical tags, sitemap, robots, social card, and desktop privacy link. |
| STAGING-01 | High impact | Real Supabase persistence, RLS isolation, cross-device restore, and account-deletion cascades remain unverified. | `web/src/data/supabaseStore.ts`, `web/supabase/migrations/*`, staging scripts | Local green tests do not prove cloud isolation or durable deletion. | **Blocked by credentials**; use only a disposable staging project and destructive test users. | `npm run test:rls:staging`, `npm run test:deletion:staging`, full restart/offline/two-client flow. |
| BILLING-01 | High impact | Free/Pro/Teams infrastructure is implemented and locally tested, but no real Stripe test-mode checkout or webhook has been executed. | `web/src/billing/*`, billing API routes, `web/supabase/migrations/20260716092442_plans_workspaces_billing.sql` | Paid entitlement activation and cancellation are not release-proven. | **Implemented but not fully tested**; production billing remains disabled. | Stripe test checkout, verified webhook replay/idempotency, failed invoice, portal, cancellation, and downgrade in staging. |
| WAITLIST-02 | High impact | Durable hosted signup and founder notification delivery have not been verified against the deployed project. | `marketing/src/app/api/waitlist/*`, `marketing/src/lib/notifyWaitlist.ts` | The form is locally tested but email delivery can remain failed if FormSubmit is unactivated or Resend is absent. | **Blocked by deployment credentials/configuration**; the admin retry state is implemented. | Hosted disposable signup using Vercel Blob plus verified Resend sender or activated FormSubmit. |
| DEP-01 | High impact | Dependency audits report 10 high findings in `app`, 4 high/1 moderate in `marketing`, 1 high/1 moderate/1 low in `web`, and 1 moderate in `extension`. Available automatic fixes require major framework/tooling upgrades. | package manifests and lockfiles | Known Electron, Next.js, build-tool, and packaging advisories remain before release. | **Open; founder/architecture sign-off required** for a controlled Electron/Next upgrade. No breaking `npm audit fix --force` was run. | Upgrade branches with full UI, packaging, API, and regression suites. |
| AUTH-01 | Medium impact | Direct email auth is development-only and does not provide email verification, password reset, or refresh-token semantics. Production uses the device flow. | auth routes and login/signup UI | Enabling the development path in production would overstate account capabilities. | **Safely gated; founder decision needed** on the long-term identity model. | Real provider signup, verification, recovery, expiry, refresh, logout, callback, and replay tests. |
| MAC-01 | Medium impact | The unsigned staging package verifies structurally, but macOS Accessibility permission, selection capture, overlay placement, signing, notarization, and restart behavior were not exercised in this mission. | `app/`, packaging scripts | Desktop usability and distribution are not release-proven. | **Implemented but not fully tested**. | Physical macOS permission matrix, signed/notarized artifact, fresh-user install, multi-display, and app-restart smoke. |
| QA-01 | Medium impact | The full six-width website screenshot matrix and automated accessibility audit were not rerun during this repository-health mission. | `marketing/src/app`, redesign components | Source/build health does not replace responsive and assistive-technology evidence. | **Open**; schedule the dedicated design/accessibility mission. | 1440/1280/1024/768/430/390 screenshots, keyboard pass, reduced-motion pass, axe/VoiceOver smoke. |
| BRAND-01 | Medium impact | Durable repository instructions call the product “Uncode” while current UI, domains, bundle ID, and public copy use “Unvibe.” | `AGENTS.md`, `CLAUDE.md`, app/marketing copy | Release naming, legal copy, Apple records, and search metadata can diverge. | **Blocked by founder decision**; do not mass-rename before approval. | Repository-wide naming audit after the decision. |
| BUILD-01 | Polish | Marketing build warns that an edge-runtime page disables static generation for that page. | marketing Open Graph image route | No build failure; the route remains dynamic. | **Open, low risk**; keep if dynamic generation is intentional. | Confirm deployed cache headers and social-card response time. |
| OBS-01 | Polish | The intentional unactivated-FormSubmit test emits a visible error stack before passing. | `marketing/src/lib/notifyWaitlist.test.ts`, `notifyWaitlist.ts` | CI output can look failed at a glance, though delivery failure is correctly recorded. | **Open**; retain production error visibility and optionally inject/capture a test logger. | Logging assertion that does not suppress real runtime failures. |

## Verification result

- App: 19/19 tests, strict typecheck, build.
- Extension: 34/34 tests, strict typecheck, build.
- Marketing: 11/11 tests, strict typecheck, lint, production build.
- Web/backend: 32/32 tests, strict typecheck, production build.
- Root `npm run verify:beta`: 22/22 checks, including repository safety, local API smoke,
  unsigned staging package, and package verification.
- Final test total: 96/96. No tests were skipped or disabled.

The aggregate verifier explicitly confirms that it did not use production, paid AI, billing,
Apple credentials, or signing identities.
