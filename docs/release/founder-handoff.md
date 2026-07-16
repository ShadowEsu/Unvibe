# Founder handoff

The codebase is prepared for a credential-gated private-beta finish, not declared released. Run local verification from root, then complete isolated staging, real-provider, two-device, packaged clean-machine, signing/notarization, accessibility, legal, and distribution gates in that order.

Founder-owned inputs: staging Supabase/Vercel projects and secrets; approved staging/production domains; provider account/key/spend limit; Apple Developer identity/notary credentials; final product name/bundle ID; support/contact addresses; tester list; legal counsel approval; release/rollback decision.

Do not share service-role/provider/Apple keys with testers or commit them. Do not enable live billing, point tests at production, or distribute the unsigned artifact. Archive commit SHA, `.release` reports, migration output, staging JSON, provider evidence, checksum, signing/notary evidence, QA matrices, and written legal approval together.

Recommended release call: founder, engineering owner, support owner, privacy/legal reviewer. Read every open item in `founder-decisions.md` and every blocker in `final-preflight-summary.md`; record go/no-go and rollback owner.
