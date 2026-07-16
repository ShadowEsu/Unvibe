# Private-beta release index

This directory is the operator entry point for a Unvibe private-beta candidate. A green local run is necessary, not sufficient: staging, real-provider, multi-device, signing/notarization, and legal review remain separate gates.

## Start here

1. Run `npm run verify:beta` at the repository root. Preserve `.release/verify-beta.json` and `.release/verify-beta.md` as build evidence.
2. Follow [staging setup](staging-setup.md), then run `npm run verify:staging` with a securely loaded staging environment.
3. Complete the [release checklist](release-checklist.md) and record each evidence link.
4. Give testers [tester onboarding](tester-onboarding.md), [known limitations](known-limitations.md), and the [feedback template](beta-feedback-template.md).

## Gate documents

- Engineering: [baseline](baseline-validation.md), [RLS matrix](rls-test-matrix.md), [offline/restart](offline-restart-test.md), [two-device sync](two-device-test.md), [packaging](packaged-app-test.md), [macOS QA](macos-qa-matrix.md), [accessibility](accessibility-checklist.md), [performance](performance-baseline.md), [Next 16](next16-upgrade-plan.md), and [Electron/build upgrades](electron-upgrade-plan.md).
- External credentials: [real provider](real-provider-test.md), [signing/notarization](macos-signing-notarization.md).
- Operations: [troubleshooting](troubleshooting.md), [support](support-playbook.md), [logging](logging-and-support.md), [rollback](rollback-plan.md).
- Founder: [handoff](founder-handoff.md), [decisions](founder-decisions.md), [preflight summary](final-preflight-summary.md).
- Legal inputs: [`docs/legal/`](../legal/README.md). Every document is a draft for counsel review.
