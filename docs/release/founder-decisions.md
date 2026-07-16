# Founder decision sheet

Record decision, owner, date, rationale, expiry/revisit date, and evidence.

| Decision | Current default | Must decide before external beta |
| --- | --- | --- |
| Product name | Repository mixes Unvibe/Uncode | Yes |
| Bundle ID | `com.unvibe.app` | Yes, before Apple records |
| Supported Macs | Apple silicon, macOS-first | Minimum OS/version |
| Tester cohort/window | Not set | Yes |
| Support/privacy/legal contacts | Placeholders | Yes |
| Staging projects/domains | Not provisioned here | Yes |
| AI provider/model/spend | Mock by default | Yes; accept cost/terms |
| “Free” promise | No durable promise approved | Define beta allowance/fair-use wording |
| Billing/Pro plan | Disabled | Keep disabled or approve test-mode plan |
| Next.js advisories | Exact allowlist, Next 16 deferred | Ship/pause decision and migration date |
| Electron/build advisories | Exact allowlist; fixes require Electron 43 and electron-builder 26 major upgrades | Ship/pause decision and migration date |
| Parked extension esbuild | Dev-only esbuild 0.20 advisory; extension is not distributed in desktop beta | Keep parked or approve isolated upgrade |
| Data retention/deletion timing | Draft only | Counsel/operations approval |
| Signing/notarization owner | Not assigned | Yes |
| Rollback authority | Founder default | Name primary/backup |

No decision here constitutes legal approval. Avoid “completely free,” “always protected,” “always private,” or “never trains” unless the exact scope, provider terms, limits, and legal review support it.
