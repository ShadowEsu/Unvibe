# claude-branches.md — branch map (so you don't redo work)

Last verified: **2026-07-23**. Regenerate the "ahead/behind" numbers if they look stale:
`git fetch origin && git rev-list --count origin/main..origin/<branch>`.

## TL;DR
- **Real trunk = `codex/design-pixel-launch-experiment`.** `main` is STALE (far behind trunk).
- Base new app/island work on trunk. Push to your own `claude/*` branch. **PR into `main`**, never merge `main` yourself.
- The launch bug + a large chunk of the island redesign are already done on trunk / PR #6 — don't rebuild them.

## Branch map

| Branch | Role | State (2026-07-23) |
| --- | --- | --- |
| `main` | Published/stable pointer | **Stale.** Missing ~61 commits of island/design work. Don't base app work here. |
| `codex/design-pixel-launch-experiment` | **Real trunk** | Newest island redesign: camera-area island, live learning dashboard, cinematic gradient, native settings, sounds, onboarding ceremony, private-beta packaging. Head: "Unify installer and app icon with onboarding gradient". |
| `codex/beta-core` | Beta foundation | Base of PR #5. |
| `codex/secure-desktop-sync` | Device sessions + sync | Built, **needs real Supabase/Vercel staging verification** before merge (see overnight backlog #1). |
| `codex/marketing-launch-redesign`, `codex/website-polish`, `marketing` | Marketing site | Website work, separate from `app/`. |
| `claude/determined-curie-l09fo1` | **PR #6** head | Launch/signing fix (`after-sign.mjs`) + island: onboarding ceremony, quiet-scene gating, bar/widget redesign, sound. Targets trunk. Awaiting review. |
| `claude/brave-heisenberg-atsilf` | **PR #7** head | Alt Dock-fix (icon assets / empty-tray theory). Targets **stale main**; largely superseded by trunk + PR #6. |
| `claude/brave-heisenberg-hrjc0w` | Older claude branch | Check before reusing. |
| `claude/brave-heisenberg-2meb42` | **This automation's designated push branch** | Diverged from trunk at merge-base `dbceb58` (Merge PR #3). Carries 5 unique commits: mac packaging/signing (`afterSignHook.cjs`, `hardenedRuntime:false`), beta usage quotas (`web/`), waitlist beta-invite emails + releases page (`marketing/`). Behind trunk on the island. |

## Open PRs (2026-07-23)
- **#5** (draft) `codex/design-pixel-launch-experiment` → `codex/beta-core`: "Ship the Unvibe private beta desktop experience." The big beta bundle.
- **#6** `claude/determined-curie-l09fo1` → trunk: **the recommended launch fix** + island redesign. Signing change → human review required; do not auto-merge.
- **#7** `claude/brave-heisenberg-atsilf` → `main`: competing Dock fix on stale base. Likely close in favor of #6/trunk.

## Two overlapping packaging fixes — reconcile, don't stack
There are now **three** independent takes on the same "damaged / won't launch" problem:
1. Trunk + **PR #6**: keep `hardenedRuntime: true`, afterSign re-sign with entitlements that
   `disable-library-validation`. (Cleanest; recommended.)
2. `claude/brave-heisenberg-2meb42` (this branch): `hardenedRuntime: false` + deep ad-hoc sign
   in `afterSignHook.cjs`. (Also works; older.)
3. **PR #7**: icon-asset/empty-tray theory (a real hardening but not the trunk root cause).

Recommendation: land **#6** on trunk; fold #7's tray-robustness idea in only if the tray is
still fragile after #6; retire this branch's competing signing config rather than merging both.
