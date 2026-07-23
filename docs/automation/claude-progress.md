# claude-progress.md — session log

Newest entry on top. Keep entries short: what you did, status, what's next.

---

## 2026-07-23 — session on `claude/brave-heisenberg-2meb42`

**Goal given:** (1) fix "built app doesn't show in Dock/menu bar"; (2) keep redesigning the
vibe-island floating bar. Also: read `claude-context.md` / `claude-branches.md` /
`claude-progress.md` first — but **those three files did not exist yet.**

**What I found (audit):**
- The three context files were missing → every prior session re-scanned the repo and
  independently rediscovered the same launch bug. That produced **three overlapping open PRs**
  (#5 beta ship, #6 launch fix on trunk, #7 launch fix on stale main). Fragmentation.
- Real trunk is `codex/design-pixel-launch-experiment`; `main` is stale. My designated branch
  `claude/brave-heisenberg-2meb42` diverged at `dbceb58` and is behind trunk on the island.
- **The Dock/menu-bar bug is already fixed** — root cause = `hardenedRuntime:true` + ad-hoc
  signature + library-validation-on → macOS kills the app at launch (no Dock, no menu bar).
  **PR #6** adds an `afterSign` re-sign hook (`app/scripts/after-sign.mjs` +
  `entitlements.local.plist` with `disable-library-validation`) and also carries a large slice
  of the island redesign. Verified internally consistent by code inspection.
- Environment is **Linux**, no `node_modules`, electron download blocked → cannot run a full
  Electron build or macOS packaging/launch here. Verification is inspection + pure-node tests.

**What I did:**
- Did NOT open a fourth Dock/island PR — that would duplicate PR #6/#5 and cause conflicts
  (task explicitly forbids duplicative churn).
- **Created the three missing automation context files** (`claude-context.md`,
  `claude-branches.md`, `claude-progress.md`) so future sessions start from state instead of
  re-scanning. This directly attacks the cause of the PR fragmentation.

**Status:** launch bug = fix authored (PR #6), awaiting founder review/merge into trunk
(signing change → must not auto-merge). Docs committed to `claude/brave-heisenberg-2meb42`.

**Next highest-value steps (in order):**
1. Founder: review + merge **PR #6** into trunk; close/retire **PR #7** and reconcile this
   branch's competing `hardenedRuntime:false` signing config so both approaches don't ship.
2. After #6 lands, resume island redesign **on top of trunk** (not this stale branch) so work
   doesn't diverge again — e.g. Glance completion (green-dot "Explanation ready" without
   auto-expand), micro-confirmation checkmarks on save/copy, Reduce-Motion paths.
3. Consider whether `claude/brave-heisenberg-2meb42`'s valuable non-app commits (beta usage
   quotas in `web/`, waitlist beta-invite emails + releases page in `marketing/`) should be
   cherry-picked to trunk via a separate small PR.
