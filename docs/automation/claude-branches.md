# Branch map (for autonomous Claude sessions)

_Last verified: 2026-07-22 by the `claude/brave-heisenberg-atsilf` session._

## The important truth
**`main` is stale for the desktop app.** The real, most-advanced desktop app lives on
`codex/design-pixel-launch-experiment` ("codex trunk"). When comparing app work, diff against
codex trunk, not `main`.

## Branches on origin (observed)
- `main` — stale trunk. Has the app at an older state; also holds marketing brand assets
  (`marketing/public/brand/icon-1024.png`, `icon.png`) — real 1024×1024 PNGs.
- `codex/design-pixel-launch-experiment` — **real desktop-app trunk.** `app/src/main/main.ts`
  is ~722 lines (vs ~336 on the older lineage). Ships the full `app/build/` asset set
  (`icon.png`, `icon.icns`, `trayTemplate.png`, `entitlements.mac.plist/.local.plist`,
  `dmg-background.png/.svg`) and already calls `app.dock?.show()`.
- `claude/brave-heisenberg-atsilf` — **this automation's designated branch** (push here only;
  never force-push, never merge to main — open a PR into main instead). Diverged from the older
  lineage *before* codex trunk's big app rewrite, so its `app/` was behind trunk.
- `codex/beta-core`, `codex/secure-desktop-sync`, `codex/marketing-launch-redesign`,
  `codex/website-polish` — feature/foundation branches. `secure-desktop-sync` has unmerged
  session/sync work needing staging review (per overnight notes).
- `automation/opencode-*`, `chatgpt/overnight-backend-default-port`,
  `claude/brave-heisenberg-hrjc0w`, `claude/determined-curie-l09fo1`, `marketing` — other
  automated lineages.

## Rules for this automation
- Push only to `claude/brave-heisenberg-atsilf`.
- Do **not** push to codex trunk directly (other automated sessions rely on it).
- Do **not** merge into `main` — open a PR.
- Base app fixes on codex trunk's behavior; a full unattended cross-trunk merge is risky and
  should not be done blind. Prefer surgical ports of specific, understood changes.

## Gotcha discovered
The root `.gitignore` line `build/` also matched `app/build/`, silently excluding the app's
**source** icon assets. Codex trunk fixed this by re-including `app/build/` and whitelisting the
specific asset files. This branch adopted the same fix.
