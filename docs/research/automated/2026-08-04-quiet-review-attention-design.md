# When to interrupt a developer: attention economics for Unvibe's quiet-review overlay

- **Date:** 2026-08-04
- **Mission:** competitor-research-and-v2 (night lab)
- **Status:** research report — no code changes
- **Read time:** ~6 minutes

## Research question

When and how should a desktop AI assistant surface a "quiet review" of code changes
without degrading the developer's attention? What do published interruption research and
current AI coding-tool practice say about timing, modality, and user control — and what
should Unvibe's v2 desktop overlay adopt, keep, or drop?

This is distinct from prior night-lab research branches on change-communication, the code
explanation landscape, learning retention, and overlay patterns: the focus here is the
**interruption and attention cost** of proactive assistance, and how "quiet" the quiet
review can actually be.

## Dated sources (public, accessed 2026-08-04)

1. Wikipedia, "Interruption science" — survey page citing the primary studies below
   (accessed 2026-08-04).
2. Mark, Gudith & Klocke, "The cost of interrupted work: more speed and stress," CHI 2008.
   Reported figures: average knowledge worker switches tasks about every 3 minutes and can
   take roughly 25 minutes to resume after a distraction (Alboher, New York Times, 2008);
   workers averaged ~11 minutes per project before interruption (Thompson, NYT, 2005).
3. Stothart, Mitchum & Yehnert, *J. Exp. Psychology: Human Perception and Performance*
   (2015) — merely receiving a notification measurably degrades sustained attention, even
   if it is never opened.
4. Iqbal & Horvitz, CSCW 2010 — answering notifications impedes task performance and
   resumption; *removing* notifications entirely can increase self-driven email checking.
5. Iqbal & Bailey, CHI 2008 — notifications relevant to the current task are less
   disruptive than unrelated ones; "intelligent notification management" reduces disruption.
6. Cutrell, INTERACT 2001 — interruptions are most costly during fast, stimulus-driven
   work (typing, button presses, scanning results).
7. Horvitz, "Balancing Awareness and Interruption: Investigation of Notification Deferral
   Policies," Microsoft Research (2005) — "bounded deferral": hold alerts and deliver them
   only when the user is free to receive them.
8. Bailey & Konstan, *Computers in Human Behavior* (2006) — argues for attention-aware
   systems that measure interruption cost on performance, error rate, and affect.
9. Kelemen et al., *Journal of Software: Evolution and Process* (2016) — a team of
   programmers was interrupted up to ~150 times a day via support chat; a dispatcher role
   plus a knowledge base cut interruptions substantially.
10. Zeigarnik / Ovsiankina (1920s) — the Zeigarnik effect: interrupted or uncompleted
    tasks are remembered better than completed ones.
11. Stangl & Riedl, "Interruption science as a research field," *Frontiers in Psychology*
    (2023) — a taxonomy of interruptions.
12. GitHub Docs, "Using GitHub Copilot code review" (docs.github.com) — product behavior.
13. CodeRabbit marketing site (coderabbit.ai) — product behavior and positioning.
14. Janaka et al., "You Cannot Optimize What You Cannot Measure: Multitasking Evaluation as
    the Missing Foundation of AI-Mediated Heads-Up Interaction," arXiv:2608.01656,
    submitted 2026-08-03 — argues that fluid, context-adaptive interfaces must be evaluated
    over *trajectories* (sequences of contexts and transitions, longitudinal trust), not
    single-session snapshots; most current evaluation is snapshot-based.
15. Unvibe source read for grounding: `app/src/main/notify.ts`, `windows.ts`, `settings.ts`,
    `main.ts`; `app/src/renderer/bar/bar.tsx`; `docs/design-system.md`, `docs/privacy.md`,
    `docs/architecture.md`.

## Observed product behavior

**GitHub Copilot code review** is almost entirely **pull-based** and **async**:

- On GitHub, the user *requests* Copilot as a PR reviewer (or opts into automatic review on
  PR events); it runs in CI and leaves a "Comment" review that never blocks merging.
- In the IDE, reviews are explicitly invoked (right-click → Generate Code > Review, or the
  Source Control "Copilot Code Review" button) and land inline plus in the Problems panel.
- Re-review must be re-requested or configured. Nothing pushes a review at the developer
  mid-edit.

**CodeRabbit** reviews asynchronously at the **PR boundary** (or on demand in IDE/CLI). Its
public positioning centers on *reducing noise*: "Find the bugs. Skip the noise." It also
markets a learning loop ("Code reviews that learn from you") and pre-merge checks. The
review arrives where developers already expect to review (the pull request), not in the
middle of typing.

**Unvibe v2 (current code, this branch's product surface):** reviews are user-invoked
(⌘U, menu-bar item, floating-bar chip). `notify()` fires only for *post-action
confirmations* ("Added to your learning history"), is rate-limited to one per 15 seconds,
and is suppressed during quiet hours. The floating bar is described in code as a "quiet
aisle — only show while a review is active," and the widget dims or collapses when it loses
focus. Quiet hours default to 22:00–08:00. There is **no proactive change detection wired
into the desktop app yet**; the parked VS Code extension had that loop.

## User problem addressed

A developer who does not fully understand code that changed (theirs or AI-written) will
either skip comprehension or interrupt their flow to seek it. The real problem is not
"generate more explanation" — it is **delivering comprehension help at a time and in a form
that costs less attention than it returns**. Products that push too hard create
notification fatigue; products that never prompt create a learning gap.

## Why it may work (or not)

**Why "quiet review" as designed has strong support:**

- Interruptions degrade performance and raise error rates (Mark et al. 2008; Bailey &
  Konstan 2006), so a design whose default is *not* to interrupt is well-founded.
- Even unopened notifications cost attention (Stothart et al. 2015) — evidence for the
  "dim / hide-by-default" approach over toasts.
- Task-relevant notifications are less disruptive (Iqbal & Bailey 2008); Unvibe's scopes
  (selected code, active file, git diff) are inherently relevance-gated.
- Bounded deferral (Horvitz 2005) is the research term for Unvibe's existing quiet-hours
  and rate-limit; there is published support for exactly this pattern.
- The Zeigarnik effect supports leaving an unfinished review "quietly pending" — the memory
  hook exists even without a nag.
- Mainstream tools (Copilot, CodeRabbit) overwhelmingly chose pull-based / PR-boundary
  review, which de-risks the timing question for a v1/v2 product.

**Why it could fail:**

- Interruptibility prediction is genuinely hard; most studies are short lab sessions with
  generic knowledge work, not mid-flow AI-assisted coding. The cost/benefit numbers do not
  transfer 1:1 to a coding overlay.
- The literature measures task metrics, not comprehension retention; there is little direct
  evidence that *when* a review appears changes how much is understood.
- A proactive cue that is too subtle may be invisible; one that is too visible becomes
  noise — the failure modes bracket a narrow design window.

## Limitations of this research

- All quantitative claims come from office/knowledge-work or lab contexts; none were
  measured inside a coding overlay.
- Product observations are from public marketing/docs as of the access date; behavior
  changes over time.
- arXiv:2608.01656 is a fresh preprint (submitted 2026-08-03) and not peer-reviewed.
- This is a desktop/macOS product; attention literature is platform-agnostic, but macOS
  interaction specifics are unverified on this Linux runner.

## What Unvibe can learn

1. **Stay pull-first for v2.** The current design (⌘U / menu-bar / bar chip) already
   matches how the strongest products and the literature behave. Do not invert it.
2. **Add bounded deferral for any proactive cue.** When a change is detected while the user
   is actively typing, hold a "pending review" state and surface it only at a natural
   breakpoint: idle for N seconds, app/window blur, file save/close. Never at peak typing.
3. **Relevance-gate before surfacing.** If the changed file is not the active file or
   selection, the review should go straight to the learning/history queue ("to revisit"),
   not to the bar.
4. **Treat even a dim cue as a cost.** Per Stothart et al. 2015, a hint the user cannot
   avoid seeing still costs attention. Prefer a static, non-animated weight/opacity change
   on the existing bar over any toast, and add a **focus mode** that suppresses even that.
5. **Express quietness with the design system, not color.** The bar already dims via
   opacity; status must be text/weight/iconography, never hue (design-system rule). Keep it.
6. **Use the Zeigarnik effect deliberately.** An unfinished review left in the "needs
   review" queue is a memory hook. Persist pending reviews quietly; never nag.
7. **Ship a consent gate before any proactive cloud review.** Per `docs/privacy.md`, the
   desktop flow currently surfaces the consent/preview screen only when the secret scan
   finds a hit. For proactive detection, per-repo consent + exact-payload preview must be
   enforced before anything leaves the machine (the v1 extension had this; the desktop
   overlay does not yet).
8. **Evaluate over trajectories, not snapshots** (Janaka et al. 2026). Log on-device
   metadata over time — when reviews start relative to activity, completion, "I understand"
   vs "needs review", dismissals — and track trust/annoyance longitudinally, not just in a
   single session. Set two guardrail metrics (e.g., prompts-surfaced-per-hour and
   dismissal-per-10-reviews) and cap them.
9. **Position on "less noise, more understanding,"** mirroring CodeRabbit's "skip the
   noise" lesson: Unvibe's differentiator is that it *asks less often and explains better*,
   never that it notifies more.

## What Unvibe should avoid copying

- Do not copy CodeRabbit's PR-review-bot UI or workflow; Unvibe is a comprehension/learning
  layer, not a reviewer.
- Do not copy Copilot/Cursor-specific affordances, exact wording, assets, or animations.
- Do not claim a proprietary "interruptibility AI" or claim the app "knows" when a user is
  free; the literature does not support precise interruption prediction.
- No colored status (design system forbids hue-based status).

## Original Unvibe interpretation

A **"pending-quiet" state** expressed through the existing floating bar: when a change is
detected and consent is granted, a review is enqueued locally, but the UI shows at most a
static, dimmed cue at a natural breakpoint (and nothing during an active typing burst or
focus mode). The review itself remains user-invoked; the bar and the "to revisit" queue act
as the quiet memory hooks. Quiet hours, rate limiting, per-repo consent, and secret
filtering remain load-bearing and on-device.

## Expected user benefit

Comprehension of changed/AI-generated code increases because the prompt arrives at a moment
it can be accepted, while the interruption cost stays near zero. Users should report the
overlay as "calm" and "out of the way," and the needs-review queue should grow without the
bar feeling noisy.

## Technical difficulty

- Low: deferral timer, focus mode, relevance gate — pure main-process logic in the existing
  `notify`/`windows`/`settings` modules.
- Medium: on-device change detection (git working-tree or file-save events) plus the
  consent/secret-scan gate before any network call. Requires macOS verification; labelled
  "unverified on Linux runner."
- Medium: privacy-safe trajectory telemetry (metadata only, no code payloads).

## Security and privacy considerations

- Detection and pending state stay fully on-device. Nothing is transmitted until the user
  invokes a review, per-repo consent is granted, and the secret scan passes.
- Telemetry must be metadata-only and avoid repo content; no new permissions beyond the
  existing Accessibility prompt for ⌘U.
- The load-bearing rule (backend never reads the repo) is unaffected: only filtered context
  ever leaves.

## Smallest validation experiment

Feature-flagged "pending review" mode: on detecting a git working-tree change, enqueue a
review; show the dimmed cue only at a natural breakpoint (≥20 s idle or window blur);
never show a toast. Over ~2 weeks compare vs. today's no-cue control: review-start rate,
understood/needs-review ratio, explicit dismissal count, and an opt-in single-question
annoyance token after the first 10 reviews. Pre-register keep criteria (e.g., keep if
review starts +15% with <5% annoyance); drop or re-tune otherwise.

## Recommendation

**v2 (desktop overlay)** — implement the incremental pieces (bounded deferral, focus mode,
relevance gate, consent gate) only after the current pull-based loop is validated in the
field; the proactive cue is an increment, not a replacement for explicit invocation. The
trajectory-based telemetry design (Janaka et al. 2026) should be agreed before the feature
ships so it can be measured from day one.
