# Vibe Island — full app teardown (competitive research)

> Research only, to understand how the product works. Nothing here is copied into Unvibe;
> where it informs our design we adapt the *technique/behavior*, never the assets or code.
>
> **Unvibe is a different product.** Vibe Island is a **notch HUD for terminal AI coding
> agents** — it monitors Claude Code / Codex / Cursor sessions and lets you approve,
> answer, and jump to them. Unvibe is a **code-comprehension overlay** — you select
> AI-written code and it explains it. We borrow Vibe Island's *experiential quality*
> (notch behavior, motion, onboarding ceremony, sound, native settings, state
> communication), not its purpose. See §5 for what actually transfers.

Compiled 2026-07-22 from three parallel research passes (UX, onboarding/pricing,
architecture). Official site is **vibeisland.app** (not `.com`). Solo dev **Edward Luo**
(@imedwardluo / GitHub `edwluo`). First beta v0.5.0 **Mar 3 2026**, 1.0 **Mar 27 2026**,
latest **v1.0.42 (Jul 18 2026)**.

## Sourcing caveat (important)

Vibe Island is **closed-source**; its marketing asserts *behavior* but not *mechanism*.
An open-source clone — **`Octane0411/open-vibe-island` ("Open Island", GPL-3, Swift)** —
independently re-derived the same integration surface (identical hook events, config
paths, per-terminal jump strategies, notch overlay, Sparkle updates). Where Vibe Island
only asserts a behavior, Open Island's docs are the best available evidence for *how Vibe
Island almost certainly does it*. Findings are labeled **[VI states]** vs
**[inferred / Open Island]**.

---

## 1. Technical architecture & how it functions

### Stack — confirmed
- **Native Swift, no Electron.** "Native Swift app built for Apple Silicon," **<100 MB
  RAM**, near-zero idle CPU. **macOS 14+ (Sonoma)**, Intel + Apple Silicon. [VI states]
- Distribution: signed & notarized **DMG** + **Homebrew cask** (`brew install --cask
  vibe-island`), auto-update via **Sparkle** (`appcast.xml` in a separate updates repo).
- UI: **SwiftUI for composition + AppKit for panel/status-item/activation-policy**;
  menu-bar accessory (`LSUIElement`, no Dock presence). [inferred / Open Island]

### The core mechanism: hook injection + local IPC bridge
The "auto-configures each CLI on first launch" claim = **config injection**. On first
launch it writes hook entries into each CLI's config so the agent calls *back into* Vibe
Island on lifecycle events. It is **not** log-scraping or screen capture (transcript
discovery only supplements it). [inferred / Open Island; corroborated by VI "zero-config"]

Config targets (Open Island, whose supported list matches VI exactly):
- Claude Code → `~/.claude/settings.json` hook entries
- Codex → `~/.codex/config.toml` (`hooks = true`, version-aware)
- Gemini CLI → `~/.gemini/settings.json`
- Cursor → `~/.cursor/hooks.json`
- Kimi → `~/.kimi/config.toml` (`[[hooks]]`; payload byte-compatible with Claude's)
- Claude-forks (Qoder, Qwen, Factory, CodeBuddy) → per-tool `settings.json`, same schema

Data path (Open Island architecture — near-certainly mirrored):
```
Agent process → fires hook, passes JSON event on stdin
  → bundled helper CLI ("vibe-island-bridge", invoked --source claude|codex|…)
  → forwards over a Unix domain socket (NDJSON, newline-delimited JSON)
  → BridgeServer runs INSIDE the app; reducer applies event → state → notch UI
  → helper writes a JSON directive to stdout ONLY when a decision is needed
  → agent acts on it
```
- Transport: **in-process bridge over a local Unix socket, NDJSON envelopes.** No cloud.
- Installed hook command points at a **copy of the helper in Application Support**, so app
  updates/renames don't break existing hooks.
- **Fail-open:** if the app/bridge isn't running, the helper exits silently → the agent
  proceeds unaffected. (A hard design rule.)
- Hook events (Claude Code, 1:1 with the official hook reference): `SessionStart/End`,
  `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PermissionRequest`, `Notification`,
  `Stop`, `SubagentStart/Stop`, `PreCompact`. Codex defaults kept low-noise.

Two other integration classes:
- **Plugin-based** (OpenCode → JS plugin in `~/.config/opencode/plugins/`; Pi Agent →
  official extension system) — opens the same socket to the bridge.
- **Process/transcript discovery** (supplement): on launch, restore cached sessions →
  discover recent JSONL transcripts (`~/.claude/projects/*.jsonl`) → reconcile against
  live terminal processes (TTY scan) → start the bridge. Special cases: Claude **Desktop**
  runs Claude Code TTY-less (detected via `CLAUDE_CODE_ENTRYPOINT` env + `NSWorkspace`
  liveness); Codex Desktop adds an app-server JSON-RPC connection.

### Approval / question / plan flow back to the CLI
Works because some hooks are **blocking** and their **stdout is a directive the CLI obeys**:
- `PreToolUse` / `PermissionRequest` **blocks**; the Allow/Deny click returns over the
  socket; the helper writes e.g. `{"hookSpecificOutput":{"permissionDecision":"allow"|
  "deny"|"ask", ...}}` and Claude Code proceeds/blocks. Matches Claude's official contract.
- **Human-in-the-loop timeouts are generous**: Open Island uses **24h** for Claude
  `PermissionRequest`, **1h** for Codex, 45s for non-blocking — so a prompt can sit in the
  notch while you're away without erroring the CLI.
- AskUserQuestion → chosen option returned as the answer directive. ExitPlanMode → plan
  text arrives via hook, rendered as Markdown; approve/feedback returns the same way.
- **Two-way is limited by which CLIs expose blocking hooks:** full GUI approve/answer works
  only for **Claude Code, OpenCode, MiMoCode** (+ Codex shell approvals). The other ~23 are
  status + notification + jump only.

### Precise terminal jump
Two parts: **(a) capture terminal-local identity at hook time** (`terminal_app`,
`terminal_tty`, `terminal_session_id`, `terminal_title`, tmux target+socket) → carried into
a `JumpTarget`; **(b) drive that terminal's native focus API on click**:

| Terminal | Mechanism |
|---|---|
| Terminal.app | AppleScript, target by **TTY** |
| iTerm2 | AppleScript session/TTY probe |
| Ghostty | Window-ID (UUID) matching, cross-Space |
| Warp | **SQLite pane lookup + Accessibility menu click** (real pane identity, not fake keystrokes) |
| WezTerm/Zellij | native **CLI pane targeting** |
| cmux | **Unix socket JSON-RPC** |
| VS Code/Cursor/JetBrains | activate via editor CLI, land on integrated-terminal tab |
| Alacritty/Hyper/Termius | **fallback: app activation only** (AX/AppleScript), best-effort |

tmux (hardest, Open Island PR #247): GUI app has no `$TMUX`, so every command targets a
client explicitly (`tmux list-clients`); panes via `tmux list-panes -a`; jump =
**`switch-client` → `select-window` → `select-pane`** + raise the host terminal, even
across Spaces; pane matched to agent by TTY. Underlying OS APIs: **AppleScript**,
**Accessibility/AX**, **`NSWorkspace`**, each terminal's **own CLI/socket**, **tmux control**.

### SSH remote
Add host in Settings → app auto-detects remote OS/arch, discovers installed CLIs,
auto-configures their hooks remotely. A **single ~2.5 MB static, dependency-free helper**
sits in `~` (no root, no daemon), relays events **back over your own SSH tunnel** (never
anywhere else), auto-reconnects with backoff, survives sleep/wake. Renders in the same
notch, tagged by server. [VI states; tunnel-carries-bridge-protocol inferred]

### Privacy — confirmed & structurally credible
"No cloud, no accounts, no telemetry." Bridge is in-process over a local Unix socket;
there's no server component; the paid model is a per-Mac **license key**, not an account.
Only expected outbound calls: license activation + Sparkle appcast. Config edits are
**reversible/non-destructive** (preserve user-authored hooks, don't overwrite a custom
status line).

### Window/overlay — [inferred, strong confidence]
Borderless **`NSPanel`** with `.nonactivatingPanel`, high window `level`
(`.statusBar`/screen-saver), `collectionBehavior` = `.canJoinAllSpaces` +
`.fullScreenAuxiliary` (floats over every Space & full-screen app without activating).
Notch geometry from `NSScreen.safeAreaInsets` / `auxiliaryTop*Area`; non-notch/external →
compact top-center floating bar; expands to auto-height for permission/question cards.

---

## 2. UX, notch interaction, motion & sound

### Presentation
- Deliberate **iPhone Dynamic Island metaphor**: compact pill hugging the notch that
  **expands** into a stack of session cards, then collapses.
- **Idle:** quiet, unobtrusive — "invisible when you don't [want it]," near-zero CPU.
- **Expanded:** one card per agent — name, terminal, project/branch, elapsed time, your
  prompt as the title, live action line (e.g. "Writing middleware.ts", tool tree `Read(...)`,
  `Edit(...) +8 −23`). Auto-expands when an agent **needs** you; highlights that one agent.
- **Glance completion mode** (key idea): a finished task can **stay collapsed with a subtle
  green dot** instead of auto-expanding — an explicit low-interruption option. "Done — click
  to jump."

### The four verbs
- **Monitor** — passive color-coded status (working / waiting / done), no interaction.
- **Approve** — permission card expands with **Allow/Deny (⌘Y / ⌘N)**; shows the actual
  diff (path, red/green lines, ±N). File edits, shell, MCP calls.
- **Ask** — AskUserQuestion inline; multiple-choice options clickable with **⌘1/⌘2/⌘3**;
  free-text supported.
- **Jump** — click a card → focus the exact terminal tab/split/tmux pane (see §1).

### Overlay & displays
- **Non-activating** ("never steals focus"). Non-notch/external → **compact top-center
  floating bar** ("collapsed pill centers correctly on external displays"). Floats over
  every Space & full-screen editor.

### Sound — a signature
- **8-bit synthesized sounds per event** (task complete, permission, question…). Importable
  **custom sound packs**. Users specifically rave about the retro sounds.
- **Quiet Scenes**: auto-silence during **Focus mode, screen locked, or recording/sharing
  your screen**. Quiet Hours. Per-agent modes: *Follow focus / Notify me / Stay silent*.
  A fix stopped it "taking over audio output when idle (AirPods switching back)".

### Color & status
- **Per-agent brand color** (Claude orange, Codex green, Gemini blue, Cursor purple) — ID by
  color, not text. Status states named on site: **idle · thinking · calling a tool ·
  waiting for permission · done**. Optional card fields: project name, git worktree/branch,
  model name (off by default), elapsed time.

---

## 3. Onboarding, settings, packaging, pricing, evolution

### Onboarding — the most-praised feature
- **Zero-config**: detects every installed CLI and auto-configures hooks locally — no keys,
  no accounts, no manual editing.
- Deliberately **theatrical / gamified** first-run: bundled **onboarding wallpaper** +
  **"ceremony sound"**, and a collectible **"Edition Card" member pass / badge** ("got my
  badge" testimonials). Repeatedly called out as "beautifully insane," "incredible."
- **Removed the Screen-Recording prompt** on first launch — it does **not** need screen
  recording. Relies on **Accessibility** (for precise jump / window control). Handles first
  launch before any CLI is installed.

### Settings surface (tabbed window; Integrations + Usage added in 1.0.32)
- **General**: auto-hide notch when no sessions; idle-session cleanup timeout; show/hide
  project name; auto terminal-title config; Docker guide (`VIBE_ISLAND_HOST`).
- **Integrations**: per-CLI hook status; custom Claude config-path (enterprise forks);
  Codex monitoring toggle; Report Bug / Feedback.
- **Notifications/Sound**: **Built-in Filters** + custom **Silence Rules** (match by working
  dir / first-prompt / title / CLI / launching app, with live preview); per-event sound
  picker; custom sound files; idle-reminder sound toggle; quick mute; softer default volume.
- **Shortcuts**: customizable collapse shortcut; disable-all switch (+ reverse); reset
  individual; respects non-QWERTY / CJK IMEs.
- **Usage**: provider select (Auto/Claude/Codex; Anthropic vs Z.ai split); used-vs-remaining
  toggle; stale-data aging indicator.
- **Display**: **panel width slider (440–800pt)** + height ranges w/ live preview;
  **notch-alignment tuning slider** across models; external-display centering.
- **Quiet/Focus**: Quiet Hours; **Quiet Scenes** (Focus/lock/screen-share); **Follow Focus**.
- **Labs**: Auto Mode; memory-restart guard; disable Codex approval detection.
- **SSH Remote**: deploy/connect/manage hosts; manual-install fallback.
- **License/"Pass"/About**: **Manage Devices** (deactivate Macs); early-adopter price;
  complete uninstall (removes all hooks/extensions/scripts); **Export Diagnostics**
  (redacted); Check for Updates; right-click pill menu → Settings / Updates / Quit.

### Packaging & pricing
- **DMG** (drag to /Applications) + Homebrew; native Swift, non-activating accessory app;
  **Sparkle** auto-update; notarized; **macOS 14+**.
- **One-time $19.99** (1 Mac; 2/3-Mac tiers ~$24.99/$34.99); early-adopter **$14.99**.
  **2-day full trial, no card required**; after expiry core monitoring stays free
  ("Free Mode"). **Perpetual license + 1 year of updates**, then keep-forever. Movable,
  concurrent-use limited; 14-day refund.
- Growth promo: **"Make a Video, Get a Full Refund"** (2k views = 50%, 10k = 100%).

### Changelog themes (Mar–Jul 2026, ~95 releases)
Recurring clusters — exactly the hard problems in our own brief:
**external-display/notch centering · hover flicker / panel behavior · sleep/wake & audio
robustness · Mission Control / Spaces · Quiet Scenes · Glance completion mode ·
terminal-jump precision · licensing/commerce hardening.**

### Competitive context
Differentiators: **26-agent breadth + two-way GUI approve/answer + precise jump + native
Swift + retro sound.** Spawned an open-source clone (`open-vibe-island`, ~1.6k stars) + six
notch-HUD forks within weeks; other lookalikes: `vibe-notch` (Claude-only), `vibebar`.

---

## 4. Key sources
- vibeisland.app — home, `/claude-code/`, `/multi-agent/`, `/ai-coding-session-tracker/`,
  `/precise-jump/`, `/ssh-remote/`, `/changelog/`, `/pricing`, `/usage/`, `/terms/`, `/reel/`,
  `/guides/monitor-multiple-ai-coding-agents/`
- github.com/vibeislandapp/vibe-island (issues), github.com/edwluo/vibe-island-updates (Sparkle)
- github.com/Octane0411/open-vibe-island — `docs/architecture.md`, `docs/hooks.md`, `CLAUDE.md`, PR #247
- github.com/nxxxsooo/opencode-vibe-island-plugin (confirms `vibe-island-bridge --source` socket)
- code.claude.com/docs/en/hooks (blocking PreToolUse/PermissionRequest contract)
- earlyterms.com/term/vibe-island, macmenubar.app/app/vibe-island

---

## 5. What transfers to Unvibe (synthesis)

Unvibe explains code; it does not monitor agents. So we take **behavior/quality**, not
features. Directly applicable:

1. **Notch presentation & "Glance" restraint.** Our island should have the same
   compact→expand discipline and a low-interruption completion mode (show "Explanation ready"
   collapsed, expand on click/hover) rather than always inflating.
2. **Non-activating `NSPanel` overlay** with `.canJoinAllSpaces` + `.fullScreenAuxiliary`,
   status-bar level, notch geometry via `safeAreaInsets`, and the **top-center floating-bar
   fallback** on non-notch/external displays. This is the single most load-bearing native
   detail — our current Electron bar can't fully match focus/Spaces behavior (see the app
   redesign brief).
3. **Onboarding as a showpiece** — bundled background + a "ceremony" moment + a sense of
   arrival, using the *real* island component with demo data. (We keep it honest: no fake
   badges unless the backend grants them.)
4. **Sound system**: short, original, per-event, with Quiet Hours + suppress during Focus /
   screen-share / recording — and crucially **no screen-recording permission** (Vibe Island
   dropped it; so should we).
5. **Native Settings** with the section taxonomy we already planned (General, Island,
   Explanations, Notifications, Shortcuts, Integrations, Privacy, Account) — and a **live
   preview** in the actual island, plus a **panel-width/height + alignment slider**.
6. **Reversible, fail-open integration** philosophy: whatever we touch (accessibility,
   clipboard) degrades gracefully and never blocks the user's editor.
7. **State communication**: color/status vocabulary and "surface the one thing that needs
   you, stay quiet otherwise" — mapped to *our* states (selectionDetected → choosingDepth →
   generating → explanationReady → saved), not agent states.

What does **not** transfer: agent hooks, terminal jump, SSH monitoring, per-CLI config
injection, quota tracking — those are Vibe Island's product, not ours.
