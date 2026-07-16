# Private-beta release checklist

For every checked item attach evidence, owner, date, commit SHA, and environment. A verbal “worked for me” is not evidence.

## Blocking engineering gates

- [ ] `npm run verify:beta` passes from a clean checkout; JSON/Markdown reports archived.
- [ ] Migrations 0001–0007 applied to isolated staging; `npm run verify:staging` passes with destructive suites enabled.
- [ ] Device approval is idempotent, redemption is one-time, expired/replayed codes are rejected.
- [ ] More than 500 events restore on a second device with no gaps/duplicates.
- [ ] Offline/restart, account switching, and account deletion checks pass.
- [ ] Real-provider checklist passes with synthetic code and spend limit.
- [ ] Package checksum, clean-machine QA, signing, notarization, stapling, and Gatekeeper assessment pass.
- [ ] macOS, keyboard, VoiceOver, reduced-motion, and permission-denied matrices pass.
- [ ] No new dependency advisory beyond the exact allowlist; Next 16 and Electron 43/electron-builder 26 decisions recorded.

## Product and operations gates

- [ ] Product name, bundle ID, supported macOS/architecture, backend URL, support email, and tester cohort finalized.
- [ ] Terms, privacy, retention, deletion, AI disclosure, and provider subprocessors reviewed/approved by counsel; published URLs confirmed.
- [ ] Billing remains disabled or a separately approved test-mode plan has passed.
- [ ] Release notes, limitations, onboarding, feedback, support, logging, and rollback material published.
- [ ] Monitoring owner and rollback decision-maker are available during the release window.

Any open item remains a blocker unless the founder signs a written, time-bounded risk acceptance. Security, privacy, cross-user access, deletion, data-loss, and signing failures cannot be waived for external distribution.
