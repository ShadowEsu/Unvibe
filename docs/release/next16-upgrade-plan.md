# Next.js 16 upgrade plan

Status: required security/dependency work, intentionally not part of this pre-release pass because it is a breaking major migration.

1. Create a dedicated branch after the beta candidate is checkpointed.
2. Read the official Next.js 15 and 16 upgrade guides; inventory Node, React, ESLint, middleware/proxy, caching, route-handler, and build-system changes for both `web/` and `marketing/`.
3. Upgrade one application at a time with exact versions and lockfiles. Do not use `npm audit fix --force` blindly.
4. Preserve current API contracts, CSP/security headers, Supabase server boundaries, streaming behavior, and static legal pages.
5. Run all unit, type, build, local API, auth, RLS, pagination, deletion, marketing form, visual, and packaged-app tests.
6. Deploy to isolated staging, compare runtime logs/latency/bundle sizes, and run the full release gate before merging.

Founder decisions: whether to pause beta for the migration, minimum supported Node/macOS versions, acceptable deployment window, and whether web and marketing migrate together. Until completed, dependency audits must allow only explicitly recorded advisory IDs and fail on new or critical findings.
