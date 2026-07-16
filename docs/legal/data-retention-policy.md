# Data Retention Policy — DRAFT (requires attorney review)

_Last updated: [DATE]._

| Data | Where | Retention |
|---|---|---|
| Learning events (reviews, outcomes, concepts, streaks) | Local device + backend (if signed in) | Until a successful account deletion from primary storage; backup/log windows are not yet approved |
| Account (email, tokens) | Backend | Until account deletion; tokens revoked on sign-out/deletion |
| Encrypted auth token | Local device (OS keychain) | Until sign-out or deletion |
| App-context metadata (app name at review time) | Local device + backend | Same as learning events |
| Selected code sent for a review | Transmitted to AI provider to generate the explanation | We do not persist raw reviewed code beyond generating the explanation; provider retention is governed by the provider [CONFIRM] |
| Backups | Backend infrastructure | [VERIFY WHETHER ENABLED; DEFINE ROTATION AND RESTORE-DELETION HANDLING] |
| Analytics/metadata logs | Backend | [DEFINE]; must exclude private code contents |

## Principles (as built)
- Private code contents are **not** written to analytics or application logs.
- Secrets are filtered on-device before any transmission.
- Unvibe does not intentionally build its own model-training dataset from reviewed code; provider use and retention require confirmation before launch.

[Fill in exact numbers with infrastructure and have counsel confirm against GDPR/CCPA obligations.]
