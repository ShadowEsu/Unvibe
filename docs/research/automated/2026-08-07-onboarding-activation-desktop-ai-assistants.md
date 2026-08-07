# Research Report: First-Run Onboarding and Activation for Desktop AI Assistants — Hotkey-First Value, Permissions, and Consent

**Date:** 2026-08-07
**Mission:** competitor-research-and-v2 (auto run)
**Researcher:** OpenCode Night Lab (automated)
**Sources:** Public product pages and public help-center articles (fetched 2026-08-07).
**Gap filled:** Prior night-lab research covered code-explanation tools, developer education,
quiet-review attention, and privacy/trust positioning. None examined how *desktop AI assistant
products* get a user from download → first value → habit, and how they front-load the two things
that most often kill a desktop overlay install: OS permissions and "what will you do with my
data". This is exactly Unvibe's v2 surface (menu-bar agent → floating bar → widget), so the
patterns here are the closest available analogues to Unvibe's own first-run loop.

---

## Research Question

How do leading desktop AI assistant/overlay products structure first-run onboarding and
activation — specifically the hotkey moment, OS-permission handling, and privacy/consent framing
— and which of those patterns should Unvibe's v2 desktop overlay adopt, adapt, or avoid?

---

## Dated Sources

| Source | URL | Date accessed | What it informed |
|---|---|---|---|
| Wispr Flow — homepage | wisprflow.ai | 2026-08-07 | Time-to-value ("download and press a hotkey"), free tier, privacy mode framing |
| Wispr Flow — "Vibe coding" page | wisprflow.ai/vibe-coding | 2026-08-07 | Vibe-coding framing; Flow positioned as an input layer over AI IDEs |
| Wispr Flow — Help Center (Getting Started) | docs.wisprflow.ai | 2026-08-07 | Setup is hotkey-centric; support funnel for install friction |
| Superwhisper — homepage | superwhisper.com | 2026-08-07 | "Select an app, press ⌥+space, and start" — one-line activation pitch |
| Raycast — homepage | raycast.com | 2026-08-07 | Keyboard-first activation; "Download and use Raycast for free"; free/Pro split |
| Crush (formerly crush.ai) | crush.ai | 2026-08-07 | **Dead product signal** — desktop AI assistant now parked as a domain; cautionary example |
| Rewind.ai — homepage | rewind.ai | 2026-08-07 | **Pivoted** — former screen-recording memory assistant is now a browser AI-tools aggregator; cautionary example |
| Unvibe — `app/src/renderer/companion/companion.tsx`, `app/src/main/main.ts` (repo) | local | 2026-08-07 | Current Unvibe onboarding: 4 steps (Welcome → Guided example → Depth → Permissions), accessibility-permission handling in `PermRow` |

Note: No product was installed or exercised on this runner. All observations are from public
web pages/help centers only. In-product dialogs (exact permission sheet copy, first-launch
tooltips) are unverified except where the public page states them.

---

## Observed Product Behavior

### Wispr Flow (wisprflow.ai) — the design benchmark for Unvibe's overlay
- **Activation = one sentence.** The entire pitch reduces to: install, press your hotkey, start
  speaking — "works in every app with no setup or integrations. If you can type there, you can
  Flow there." Hotkey (not onboarding UI) is the product's activation moment.
- **Zero-friction first value.** The homepage links a **web demo** ("Try Flow instantly —
  experience dictation in your browser before you install the app"). Time-to-first-value is
  moved *ahead of* install.
- **Free tier as the funnel.** "Free, with no trial countdown or credit card required, for
  2,000 words per week"; Pro for unlimited. Free is deliberately generous enough to form the
  habit; the wall is usage, not a trial clock.
- **Privacy as a launch credential.** "Privacy Mode means zero dictation stored on our
  servers. Never sold, never shared. SOC 2 Type II, HIPAA and ISO 27001 certified." Also
  "Your data is never used for model training unless you opt-in." Trust marks sit next to the
  download button, not buried in a settings page.
- **Vibe-coding page** (2026) positions Flow *around* AI coding tools (Cursor, Windsurf, Warp,
  Replit, GitHub Copilot): voice becomes the input layer on top of vibe coding, and one of the
  named use cases is **"Learning & Skill Building — ask AI to generate a Flask API, then have
  it explain the code."** Independent public validation that "explain the generated code" is a
  recognized need in the AI-coding workflow.
- **Help center is hotkey/troubleshooting heavy** (Command Mode, supported shortcuts, login
  issues) — i.e. the setup surface is small and the ongoing surface is "why did my hotkey stop".

### Superwhisper (superwhisper.com)
- **One-line activation, same shape as Flow:** "Select an app, press ⌥ + space and start
  dictating to try it out yourself." The hotkey IS the onboarding.
- Social proof of large logos (Vercel, Spotify, OpenAI, Shopify, Meta, Apple). No elaborate
  wizard content on the landing page — activation-first, value-demo-first.

### Raycast (raycast.com)
- **Keyboard-first as identity:** "Fast. Think in milliseconds. Ergonomic. Keyboard First.
  Native. Pure performance. Reliable. 99.8% crash-free rate." Activation = install → press the
  hotkey → search; the value sentence is the promise that the tool is *faster than the thing it
  replaces*.
- **Free download, Pro upsell, no trial clock:** "Download and use Raycast for free." Extension
  store + free core; Pro and Teams add AI/cloud features. Free tier is genuinely usable, which
  is what lets the habit form before monetization.
- Trust surface is prominent: a dedicated **Trust Center** (trust.raycast.com) is linked in the
  main footer, again at the *product* level, not inside a settings page.

### Dead/pivoted competitors (cautionary signals)
- **Crush (crush.ai):** former AI desktop "personal assistant" (memory + meeting capture) is now
  a parked domain ("homebase for your AI startup"). The desktop-assistant-with-recording
  category lost a prominent player.
- **Rewind.ai:** the former screen-recording "memory" assistant has pivoted to a browser-based
  aggregator of 400+ AI tools (rewind.ai now sells token pools, chat, image gen). It no longer
  does on-device capture on the landing page at all.
- Implication for Unvibe: the *always-on screen/mic capture* assistant category is where
  trust-heavy desktop products died or pivoted; permission-heavy onboarding without clear
  value framing is a known graveyard. Unvibe's narrower ask (read the code you *select* +
  per-repo consent) is materially lighter than screen-recording, and should be sold as such.

---

## User Problem Addressed

A desktop overlay tool faces two first-run killers: (1) **OS permissions** — accessibility /
screen / mic prompts that feel like "this app wants to watch everything", and (2) **unclear
value** — "why does this live on my desktop rather than in my editor?". The products above solve
#2 by making activation a *hotkey*, not a wizard: you get value in the first 30 seconds and the
permission ask happens only when it becomes necessary and understandable. Wispr Flow inverts the
usual order by offering a browser demo *before* install. Unvibe's v2 onboarding must do the
same: the accessibility permission (currently step 4 of 4) should be optional, explainable, and
scoped to *selected* code — which the current implementation already does.

---

## Why It May Work (or Not)

### Why the hotkey-first / demo-first pattern may work for Unvibe
1. **It matches the competitor evidence.** Three successful desktop tools (Wispr Flow,
   Superwhisper, Raycast) all make the hotkey the activation moment. Unvibe's ⌘U shortcut +
   "learning island" is the same shape; the existing onboarding already ends with "Use selected
   code anywhere" via the shortcut.
2. **Permissions should be optional and deferred, not gated.** Unvibe's step 4 already says
   "You can skip it and still paste code, choose files, and learn locally." That is the right
   pattern and matches the competitor evidence that permission-gated onboarding is the graveyard
   (Crush/Rewind).
3. **Privacy framing belongs at the value moment, not the settings page.** Wispr Flow and
   Raycast put trust marks next to the download button. Unvibe's onboarding step 0 already shows
   "Local filter on · You stay in control" — good, but it is not currently backed by the same
   certifications the competitors lead with (Unvibe has no SOC 2-type badge to show; it should
   lead with *architecture* instead: "code is filtered on-device, backend never reads the repo").
4. **A "demo before install" has a cheap analogue for Unvibe.** Unvibe already has a guided
   example inside onboarding (step 1: `if (!user.isVerified)`). An installable demo isn't needed;
   the in-app guided example is the right equivalent.

### Why it may not work
1. **The hotkey-first pattern depends on a single, obvious trigger.** Unvibe's core loop
   triggers on a *code change/selection*, not on the user pressing a hotkey. If the v2 bar shows
   before the user has ever pressed ⌘U, "what is this strip?" becomes a first-run question the
   competitors never have to answer. The demo-first approach must teach *the moment it appears*,
   not just the hotkey.
2. **Permission aversion is higher for a code-reading tool than a dictation tool.** A developer
   might grant mic access to a dictation app reflexively; granting Accessibility to a tool that
   reads *their repo* is a bigger ask. The per-repo consent model (already in the design) is
   Unvibe's counter, but it must be surfaced during onboarding, not discovered later.
3. **Free-tier generosity is a budget question.** Wispr Flow's 2,000 words/week is cheap for
   them to serve; an LLM explanation per review is not free to Unvibe. Unvibe's beta quota
   (30 selected-code prompts/month) is far stingier than the competitor pattern and will feel
   like a trial clock — a known friction the competitors deliberately avoid.

---

## Limitations (as of August 2026)

- Landing-page and help-center content only; no installed-app observation of permission-sheet
  copy, first-launch tooltips, or progress-through-onboarding metrics on any product.
- Wispr Flow/Superwhisper/Raycast are dictation/launcher tools, not code-comprehension tools.
  Their onboarding optimizes for "start dictating"; none has a per-repo consent or secret-scan
  step, so Unvibe's consent design has no direct competitor to copy from (it must be
  original).
- Neither dead product (Crush, Rewind) documents *why* it failed; their absence is treated only
  as a weak cautionary signal, labelled speculation where it goes further than the evidence.
- No primary metrics (activation rate, permission-dropout rate) are public for any of these
  products.

---

## What Unvibe Can Learn

1. **Make the hotkey the hero of onboarding.** Step 4 already ends on the shortcut; consider
  making the shortcut visible in *every* onboarding step and on the floating bar itself
  ("press ⌘U anywhere"), matching Flow/Superwhisper's single-sentence activation.
2. **Defer and de-emphasize the permission.** It is already last and skippable — keep it that
  way, and never auto-open System Settings without the user asking (the current
  `accessibilitySettingsOpenedThisSession` guard in `main.ts:262` already does this correctly
  for ⌘U; the onboarding `PermRow` only opens on explicit button press).
3. **Lead with the trust *architecture*, not a badge.** Unvibe has no SOC 2 badge yet. Its
  credible claim is structural: "secret scan before every request; backend never reads the
  repo." That claim is *stronger* than a certification for this audience and should be the
  headline of the privacy signal, alongside the existing "Local filter on".
4. **A demo moment already exists — keep it first-class.** The guided `if (!user.isVerified)`
  example is Unvibe's "browser demo". It is good; make it interactive (the user can already
  toggle Understand / Explain differently) and treat it as the product's activation, not a
  formality.
5. **Honestly budget the free tier.** Align the free allowance with the competitor principle
  ("enough to form the habit") or clearly frame the quota as a private-beta gate — don't leave
  it feeling like a trial clock.

---

## What Unvibe Should Avoid Copying

1. **No "no-setup / works in every app" claim.** Wispr Flow's phrase is true for dictation;
  Unvibe reads *code and repos*, which requires real setup (per-repo consent, secret filter).
  Claiming zero-setup would be false and would erode the trust the product is built on.
2. **No always-on capture.** Crush/Rewind's category (screen/mic recording memory) is where
  trust died. Unvibe must never blur the line toward "records what you do" — the selected-code
  + explicit-review model is the differentiator and the protection.
3. **No trial-clock free tier.** Wispr Flow and Raycast both avoid countdown trials; Unvibe's
  quota must not read as a 30-day trial. Frame limits as a beta gate or align them to the
  habit-forming generous tier.
4. **No certification marketing without the certification.** Do not display trust badges Unvibe
  does not hold; lead with the verifiable architecture claim instead.
5. **Do not copy Flow/Raycast landing language, layout, or motion.** The black/white restrained
  design system stays; this report is about patterns, not assets.

---

## Original Unvibe Interpretation

Desktop AI assistants win on **activation velocity**: one obvious trigger, value in seconds,
permissions deferred until meaningful, trust stated at the value moment. Unvibe's interpretation
is that its activation trigger is *not* a hotkey but **the first real review** — so onboarding
must do the inverse of Flow: instead of "press a key anywhere", Unvibe should teach "when AI
code lands in front of you, this strip appears, and it explains only what you choose". The
hotkey stays, but the *mental model* is ambient and event-driven, which is what differentiates
Unvibe from every dictation tool. Consent is handled the original way competitors can't copy:
per-repo, previewed, filtered on-device — turning the permission step from a barrier into the
product's core proof of trust.

---

## Expected User Benefit

- A developer reaches their first explanation in under a minute (hotkey-first, optional
  permission), instead of dropping out at an accessibility prompt.
- The floating bar and widget are understood the first time they appear, because onboarding
  teaches the *event* ("code just changed — here's the strip"), not just the shortcut.
- Privacy-sensitive users get a concrete, previewable, per-repo consent decision up front,
  which is the strongest possible answer to "what do you do with my code".
- Reduced first-run dropout — the single biggest lever for a desktop overlay product, and the
  reason Flow/Superwhisper/Raycast all converged on the same activation pattern.

---

## Technical Difficulty

| Component | Difficulty | Notes |
|---|---|---|
| Keep permission optional/skippable | None | Already implemented (`companion.tsx` step 4; `PermRow` skip path) |
| Surface the shortcut on the bar itself | Low | Renderer-only; widget/bar header already exists |
| Interactive guided example (stronger demo) | Low | Already 90% there (`ob__sample` toggles); extend wording only |
| Per-repo consent surfaced during onboarding | Medium | Consent flow exists in `review.ts` (secret findings → consent event); needs a first-run entry point and copy |
| Trust-architecture headline copy (no badge) | Low | Copy-only; must stay honest ("backend never reads the repo") |
| Free-tier framing aligned to competitor principle | Medium | Touches quota logic + usage UI (`trial.ts`, `usage.ts`); budget/legal input needed |
| Always-on capture | **Forbidden** | Never build this (privacy + competitor evidence) |

---

## Security and Privacy Considerations

- No new data surfaces. Everything above reuses existing on-device secret filtering
  (`review.ts` consent event) and the existing permission-gate code in `main.ts`.
- The consent ask is the sensitive part: it must be **per-repo, previewable, and revocable**,
  and must make clear what is and is not transmitted. Do not weaken the "backend never reads
  the repo" guarantee to smooth onboarding.
- Do not add certifications Unvibe does not hold; do not claim "no setup" when setup is real.
- Per-repo consent is not optional to get right: it is the direct counter to the dead-category
  trust problem (Crush/Rewind), and the one place Unvibe must be more careful than its
  dictation competitors, not less.

---

## Smallest Validation Experiment

Ship an onboarding variant that moves the accessibility permission to a **collapsible, opt-in
"set this up later"** step (already the current design — make it explicit) and adds the
shortcut + trust-architecture line to every step. Then measure, in the private beta:

1. **Completion rate** of onboarding (any completed vs. started), before/after the copy change.
2. **Permission grant rate** at onboarding vs. granted later via the widget/companion — test the
   hypothesis that deferring increases total grants.
3. **First-review time**: minutes from app launch to first recorded review event.
4. **Dropout point**: which onboarding step loses the most users (a single analytics event per
   step is enough; metadata-only, per privacy rules).

Hypothesis: deferring the permission and teaching the *event* (not just the hotkey) raises
completion and first-review time stays under a minute. If confirmed, it justifies the
overlay-first delivery model against a settings-heavy setup.

---

## v1, v2, or Later Recommendation

| Pattern | Recommendation | Rationale |
|---|---|---|
| Optional, deferred accessibility permission | **v1 (already done)** | Current step 4 is skippable; keep and sharpen copy |
| Shortcut shown on bar + every onboarding step | **v1** | Tiny renderer change; matches competitor activation pattern |
| Trust-architecture headline in onboarding | **v1** | Copy-only, honest, high impact for a privacy-sensitive audience |
| Interactive guided example as the activation moment | **v1** | Already built; formalize it as the product's demo |
| Per-repo consent surfaced in onboarding | **v2** | Consent flow exists; first-run entry point is a UX decision for the desktop pivot |
| Free-tier generosity aligned to habit-forming | **v2** | Needs budget/legal sign-off; beta quota is fine as an explicit gate meanwhile |
| Any always-on capture | **never** | Privacy + the dead-category signal; hard boundary |

---

## Key Takeaways

1. **The desktop-AI-assistant activation pattern is settled:** hotkey-first, value in seconds,
   permission deferred, trust shown at the value moment (Wispr Flow, Superwhisper, Raycast).
2. **Unvibe's twist is that its trigger is an event, not a hotkey** — onboarding must teach
   "the strip appears when AI code lands", which no dictation tool can model.
3. **Permission-gated, capture-heavy assistants are the graveyard** (Crush parked, Rewind
   pivoted). Unvibe's selected-code + per-repo-consent model is the right shape; it should be
   sold as a lighter, safer ask, not hidden.
4. **Privacy strength is architectural, not badge-based** for Unvibe today: "secret scan before
   every request; backend never reads the repo" is the honest headline.
5. **Do not copy competitor landing claims** ("no setup anywhere") or dead-category capture
   models; the black/white design system and per-repo consent stay non-negotiable.
