# Overnight backlog

| Priority | Task | Category | Evidence | Risk | Effort | Required environment | Founder approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Stage-test secure device sessions and sync | Authentication / sync | `codex/secure-desktop-sync` is built but has no real Supabase verification | Medium | Medium | Staging Supabase + Vercel secrets | No, deployment review required |
| 2 | Verify packaged macOS app callback and Keychain persistence | Packaging / auth | Static checks only; no signed package test | Medium | Medium | macOS package + staging backend | No |
| 3 | Add RLS isolation integration tests | Database security | Migrations are present but un-applied | Medium | Medium | Disposable Supabase project | No |
| 4 | Audit desktop shortcut registration against Command+U product decision | Desktop interaction | Current docs mention Option+Space while overnight brief specifies Command+U | Low | Small | macOS desktop | Yes, shortcut decision |
