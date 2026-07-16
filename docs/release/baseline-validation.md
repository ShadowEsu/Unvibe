# Baseline validation

Validated on 2026-07-15 from commit `5e557ef` on `codex/beta-core`.

Environment: macOS 26.2 (arm64), Node.js 25.7.0, npm 11.10.1. These results describe the local, credential-free paths only. No staging or production service was contacted.

| Surface | Command | Result | Elapsed |
| --- | --- | --- | ---: |
| Desktop | `npm run typecheck` | Pass | 7.45 s |
| Desktop | `npm test` | Pass, 18/18 | 4.71 s |
| Desktop | `npm run build` | Pass | 3.26 s |
| Desktop | `npm audit` | Pass, 0 vulnerabilities | 4.75 s |
| Web/backend | `npm run typecheck` | Pass | 6.61 s |
| Web/backend | `npm test` | Pass, 12/12 | 4.36 s |
| Web/backend | `npm run build` | Pass | 18.71 s |
| Web/backend | `npm audit` | Known exception: one high and one moderate advisory in the Next.js 14 line | 6.71 s |
| Extension (parked) | `npm run typecheck` | Pass | 6.31 s |
| Extension (parked) | `npm test` | Pass, 34/34 | 4.23 s |
| Extension (parked) | `npm run build` | Pass | 2.74 s |
| Extension (parked) | `npm audit` | Pass, 0 vulnerabilities | 3.14 s |
| Legacy server | `npm run typecheck` | Pass | 5.82 s |
| Legacy server | `npm audit` | Pass, 0 vulnerabilities | 3.60 s |
| Marketing | `npm audit` | Fail: critical and moderate advisories caused by Next.js 14.2.5 | 7.19 s |

`git diff --check` passed. A repository secret-pattern scan found no committed Anthropic, Stripe live, Supabase personal-access, or assigned service-role values. The only untracked paths were the pre-existing local-only `app/.tools-bin/` and `web/.vercel/`; they were not modified or staged.

## Decisions from the baseline

- Upgrade the marketing site from Next.js 14.2.5 to the already-used 14.2.35 patch release and rerun its checks.
- Do not auto-upgrade the web/backend to Next.js 16. That is a breaking major migration and remains a founder-approved follow-up; the release verification must identify the acknowledged advisory without hiding new findings.
- Treat Supabase, real-provider AI, account deletion against staging, two-device sync, signing, notarization, and distribution as unverified until their credential-gated runbooks are completed.

Timing was captured with `/usr/bin/time -p` while independent surfaces were run concurrently. It is a reproducible engineering baseline, not a performance benchmark.
