# Unvibe — full app teardown (how our own product works)

> Internal reference. Companion to `docs/research/vibe-island-app-teardown.md`: that doc is
> how Vibe Island works; **this** doc is how Unvibe works today, with the honest gaps.
> Compiled 2026-07-22 from two repo-exploration passes + firsthand code reading.

## What Unvibe is

Product codename **Unvibe**, internal name **"Uncode"** (`CLAUDE.md` / `AGENTS.md`). A
**macOS-first code-comprehension overlay**: you select AI-written code in any app → Unvibe
captures it → you pick an explanation depth (New → Expert) → it explains the code *in your
project's context*, streaming token-by-token → you can ask follow-ups, take a comprehension
check ("Test me"), and **save concepts/snippets** into a personal learning history. It is
**not** an agent monitor (that's Vibe Island) — the value is understanding/verifying/retaining
AI-written code.

**The load-bearing rule** (`CLAUDE.md`): *the backend never reads the repo — it only receives
already-filtered context.* All capture + secret filtering happen on-device in the Electron
main process; the renderer/webview never does network I/O.

## Repo layout (monorepo, not a real workspace manager)

| Dir | What it is | Stack / status |
|-----|-----------|----------------|
| `app/` | **Primary surface** — the desktop overlay (menu-bar agent, floating bar/island, explanation widgets, companion dashboard) | Electron 36 + React 19 + esbuild + TS, macOS arm64, `com.unvibe.app`. Talks to backend at `localhost:8787` (`UNVIBE_BACKEND` override) |
| `web/` | Shared **backend + companion dashboard** — AI endpoints, auth, sync, billing | Next.js 14 (App Router), React 18, Supabase, Stripe, port **8787** |
| `marketing/` | **unvibe.site** — separate marketing site (waitlist, pricing, investors) | Next.js 14, Tailwind, Framer Motion + GSAP, port 3000. Independent of `web/` |
| `extension/` | The **original v1** VS Code/Cursor extension — **parked** at the desktop pivot, logic reused in `app/` | VS Code `^1.85`, esbuild |
| `server/` | **Legacy** framework-free AI dev harness — superseded by `web/src/ai`, kept for fast iteration | Node built-ins + tsx, port 8787 |
| `docs/` | architecture, design-system, privacy, billing, release (~35 files), legal (~15 drafts), investors, automation, research | — |

Governance: `README.md`, `CLAUDE.md`/`AGENTS.md` (Claude and Codex variants of the same
guide — note `CLAUDE.md` says AI layer = Anthropic Claude, `AGENTS.md` says Codex),
`OWNERSHIP.md` (proprietary; owner Preston Jay Susanto).

### How they fit together
`app/` (or parked `extension/`) captures a selection/file/diff on-device → runs the **local
secret filter in the Electron main process** → POSTs filtered context over HTTPS to `web/` at
`:8787` → `web/` authenticates (device-code bearer / session cookie), picks an AI provider
(Anthropic → Gemini → mock), streams the explanation back as **SSE** (`/api/v1/reviews`),
records learning events/quizzes/skills into the `Store` (Supabase in prod, MemoryStore in dev),
enforces Stripe plan limits, and serves the companion dashboard. `server/` is the earlier
version of that AI endpoint. `marketing/` shares nothing with `web/` except the product story
and the hosted demo-video URL.

---

## The island / overlay today

There is **no single "island" window.** The visual model is a **floating strip + a separate
detached review panel + a normal companion window** — three independent `BrowserWindow`s
(`app/src/main/windows.ts`) plus a menu-bar tray. This is the core structural finding.

### a) The bar / "island" strip — `createBar()` (`windows.ts:59`)
- **196×44** collapsed, expands to **410×132** on hover. Frameless, transparent,
  `focusable:false`, `alwaysOnTop('screen-saver')`, visible on all Spaces incl. full-screen,
  hidden in Mission Control. Positioned at one of four corners (`barPosition`; default
  top-center).
- Renders `bar.tsx`, which is explicit: *"intentionally not a Dynamic Island clone… a small,
  persistent status surface."*
- **Hover expansion is a real OS window resize** (`resizeBar()`), not CSS, so the transparent
  area never blocks clicks to apps behind it.
- Content: play chip (`bar:review`), logo, status text, privacy pill ("local scan"/"paused"),
  home chip (`openCompanion`); expanded drawer shows last lesson + streak/explained + actions.
  Data via `bar:snapshot` (polled).
- **This session added:** native right-click menu (`bar:contextMenu`), Pause/Resume, Explain
  Clipboard, Settings item — sharing one `buildAppMenu()` with the tray.

### b) The review panel — `buildWidgetWindow()` (`windows.ts:198`)
- **300×360** default, min 280×240. Frameless, transparent, `resizable:false` (OS resize
  disabled — the hit-rim sits outside the visible card), `alwaysOnTop('pop-up-menu')`.
- **Singleton** `panelWin` reused by ⌘U so windows never stack. Persists bounds, snaps to
  edges, migrates old stock sizes.
- Custom **resize** via 8 renderer border grips → `widget:resizeStart` → main runs a **16ms
  cursor-poll `setInterval`** calling `applyWidgetResize` each tick. **Collapse** → main
  stashes bounds and forces height to **52px**. Blur → `dim` opacity or `collapse` per
  `inactiveBehavior`.

### c) The companion — `createCompanion()` (`windows.ts:275`)
- Normal **1180×780** window (Dock/Cmd-Tab), the learning home: Home / Study / History / Quiz /
  Progress / Plan / Projects / etc. (`companion.tsx`).

---

## The full explanation flow (exact channels & events)

Pipeline (`review.ts`): **capture → build context → local secret filter → (consent) → stream →
record → sync.**

1. **Trigger** — ⌘U global shortcut, bar play chip (`bar:review`), tray, or companion
   (`companion:review`) → `startReview()` (`main.ts`).
2. **Capture** — `Promise.all([captureSelection(), frontmostApp()])` (`selection.ts`):
   Accessibility selection read with a **clipboard fallback**; frontmost-app detection.
3. **Session + panel** — `getOrCreateWidget()`; a `ReviewSession` stored in `tabSessions`
   keyed by tab id.
4. **Depth** — default `intermediate`; `LEVELS` = new/beginner/intermediate/advanced/expert
   (⌘1–5). **`expert` is Pro-gated** (enforced in `runReview`).
5. **Init** — `initWidget()` sends **`init`** event with `hasCode`, `sourceApp`, `file`,
   `lines`, `language`, a 600-char renderer-local `preview`, `autoStart`.
6. **Build context** — `buildSelectionPayload()` (`contextBuilder.ts`); nearby-file expansion
   **Pro-only** (`withNearby: isProPlan`). Also `buildDiffPayload` (git diff / agent brief),
   `buildComparePayload` (since-last-understood).
7. **Secret filter** — `scanPayload()` scans code + nearby + each import + each diff hunk
   **before any network/local-AI call**. Blocking → **`blocked`** (nothing sent); non-blocking
   suspects without consent → **`consent`**.
8. **Stream** — **`status`** ("thinking") → **`usage`** → local AI (`streamLocalAi`) or
   `POST ${BACKEND}/api/v1/reviews` SSE. SSE `StreamEvent`s parsed and forwarded as **`token`**
   / **`done`** / **`error`**. Renderer accumulates tokens with a rAF progressive reveal.
9. **Ready** — **`done`** → recorded on-device via `recordReview()`; usage refreshed.
10. **Follow-ups:** Understand ✓ (`widget:gotIt` → `markUnderstood` → **`understood`** →
    collapse) · Explain differently (`request({variant:'different'})`) · Test me
    (`widget:testMe` → `startComprehension` → **`question`**, answer withheld; `widget:answer`
    → `gradeComprehension` → **`graded`**) · Ask follow-up (free text → `request({question})`)
    · Stop (`widget:cancel` → **`cancelled`**).

**Full `WidgetEvent` union** (`review.ts`): `init`, `status`, `consent`, `blocked`, `token`,
`done`, `error`, `cancelled`, `question`, `graded`, `usage`, `understood`.

### States actually rendered (widget `Phase`)
`boot` (capturing…) · `ready` (reading in context…) · `empty` (clipboard/file/diff picker) ·
`consent` (secret findings) · `blocked` (credential block) · `streaming` · `done` (+ foot
chips) · `error` (retry/upgrade). Orthogonal **Quiz** sub-state: `loading → answering →
grading → graded`. Plus `collapsed`, tab list, per-tab history archive, usage/proGate.

---

## Privacy / secret filtering

- **Where:** `app/src/core/secretFilter.ts`, **main process only**, on the exact text about to
  be sent (`scanPayload` in `review.ts`) — *before* any call. *"Nothing leaves the machine
  without passing through here first."*
- **Two severities:** `block` (hard stop) and `suspect` (surfaced for judgment).
- **Block patterns:** AWS key id, Google API key, Slack/GitHub/Stripe tokens, PEM private key,
  JWT, generic `secret/token/password=…`.
- **Suspect:** high-entropy tokens (length ≥25, Shannon entropy ≥4.5 bits/char). Findings carry
  only a **masked** preview, never the raw value.
- **Sync exclusion:** learning events strip `code` and `explanation` before any remote mirror
  (`learning.ts forSync()`); the `init` preview is renderer-local, never persisted.

## Learning / mastery model (`app/src/core/learning.ts`, pure + unit-tested)

- **Recorded event** (`LocalEvent`): id, ts, `explanation_completed`, localDate/timezone,
  scope, level, `outcome` (reviewed|understood|needs_review), lines, language, sourceApp, file,
  project, concept, + local-only code/explanation (capped 40k/60k chars).
- **Streak:** consecutive active days back from today; `bestStreak` = longest run.
- **Mastery** (deliberately cautious): per concept, latest `needs_review` → *Needs review*;
  else by count of `understood` — ≥3 *Strong*, 2 *Familiar*, 1 *Developing*, else *New*.
  *"one correct check is developing, never 'mastered.'"*
- **Profile:** review/understood/needs-review counts, lines, concept tallies, streak, app-usage
  buckets, a 182-day intensity heatmap.
- **Spaced review** (`computeReviewQueue`): needs_review first, then understood past
  1/3/7/14-day intervals.

## Backend (`web/`) surface

- **API** (`app/api/v1/*`): auth (device-code: `device`/`approve`/`token` + signin/up/out),
  learning (`reviews` SSE, `comprehension`, `events`, `history`, `projects`, `profile`,
  `account`), billing (`checkout`/`portal`/`overview`/`webhook`…), `trial/usage`, `health`,
  workspaces/teams + invitations.
- **Data layer:** `Store` abstraction → `SupabaseStore` when `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` set, else `MemoryStore` (prod refuses it without
  `UNCODE_ALLOW_MEMORY_STORE=true`).
- **Auth:** Bearer / HttpOnly `uncode_session` cookie; special sealed-desktop-trial bearer
  (`UNVIBE_TRIAL_TOKEN`, constant-time compare).
- **AI:** `selectProvider()` = Anthropic (`ANTHROPIC_API_KEY`) → Gemini → labelled Mock.
- **Billing:** Free $0 / Pro $8mo / Teams $8/seat (min 2). Server-authoritative.
- **Schema** (`web/supabase/migrations`, additive-only): `users`, `events`, `device_codes`,
  `tokens`, `consent_log`, `skills`; billing/teams tables (`workspaces`, `subscriptions`,
  `usage_monthly`, …); `trial_usage`. RLS "self-read" throughout.

---

## Gaps vs a state-driven "island" (what the redesign must close)

1. **No central presentation state machine.** State is split three ways — main-process
   `ReviewSession`, an ad-hoc `tabSessions`/`activeTabId`/`panelReady` map in `main.ts`, and the
   renderer `Phase` + `Quiz` + `TabState[]`. Transitions are implicit per event, not a declared
   graph (`understood` is even a no-op in the reducer).
2. **The "island" is three disconnected windows** with no shared state — the bar only polls via
   `bar:snapshot`, so it can drift from the panel.
3. **Geometry is backend-driven** — a 16ms cursor-poll resize loop, a forced 52px collapse
   height, and OS-resize hover-expand — none derived from a UI state model.
4. **Electron, not native.** The bar is a floating strip on `screen-saver` level, not a
   notch-anchored non-activating `NSPanel`; can't fully match Vibe-Island-grade focus/Spaces
   behavior (see the desktop redesign brief).
5. **Vestigial paths:** `widget:pin` is fully wired but never called; `QuizMode` exists in the
   protocol but Test-me never sets it; `createWidget` is a deprecated alias.

**Direction (from the Vibe Island teardown §5):** introduce one **presentation coordinator**
mapping product states (idle → selectionDetected → choosingDepth → capturing → generating →
streaming → explanationReady → saving → saved) to presentation levels (dormant → micro →
compact → expanded → fullCard), unify the bar+panel into one state-driven surface, and move
toward a native non-activating overlay with a top-center floating-bar fallback.

## Branches & automation (quick reference)

- `main` — original default, now **stale**.
- `codex/design-pixel-launch-experiment` — **de-facto trunk**; island + pixel/launch work lands
  here; PRs target this, not `main`.
- `claude/determined-curie-l09fo1` — **current working branch** (off the trunk); the user asked
  that **all future scheduled tasks run here**.
- Automation: `.github/workflows/unvibe-autonomous-night-lab.yml` (gated by `NIGHT_LAB_ENABLED`;
  uses OpenCode Zen / DeepSeek — different from the product's Anthropic/Gemini). Session log in
  `docs/automation/claude-progress.md`; status/backlog in `docs/automation/overnight/`.
- Known blockers (`overnight/`): no real Supabase/Anthropic **staging creds** → cloud auth/sync/
  streaming + packaged-macOS sign-in unverified; a shortcut-decision conflict (docs say
  Option+Space, brief says ⌘U) awaits founder sign-off.
