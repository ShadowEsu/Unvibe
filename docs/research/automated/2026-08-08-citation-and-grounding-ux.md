# Research Report: Citation and Source-Grounding UX in AI Code Explanations — File/Line References, Verifiability, and Trust

**Date:** 2026-08-08
**Mission:** competitor-research-and-v2 (night lab)
**Researcher:** OpenCode Night Lab (automated)
**Status:** research report — no code changes
**Sources:** Public product documentation and product pages (fetched 2026-08-08)
**Gap filled:** Prior night-lab reports covered the code-explanation landscape (07-28), explanation levels (07-28), AI change communication and the understand-before-approve gap (08-01), privacy/trust positioning (08-02), quiet-review attention economics (08-04), metacognition/calibration (08-05), and first-run onboarding (08-07). None examined **how AI coding tools present source citations — file + line references — inside explanations, and whether those citations are verifiable, clickable, and trustworthy**. Unvibe already renders `[[cite:FILE:LINE]]` markers as citation chips in its widget (see `app/src/renderer/shared/richText.tsx`), so this is a directly actionable design input for the v2 overlay.

---

## Research Question

How do leading AI coding assistants surface the sources (files, line ranges, symbols) behind an explanation — and how do they make those references verifiable, clickable, and trustworthy? Which citation patterns should Unvibe's v2 overlay adopt, adapt, or avoid for its `[[cite:...]]` chip system?

---

## Dated Sources

| Source | URL | Date accessed | What it informed |
|---|---|---|---|
| GitHub Copilot Chat docs (VS Code) | code.visualstudio.com/docs/copilot/copilot-chat | 2026-08-08 | "Used *n* references" dropdown above responses; reference list showing files used |
| GitHub Copilot Chat docs (VS/VS Code/Xcode) | docs.github.com/en/copilot/using-github-copilot/asking-github-copilot-questions-in-your-ide | 2026-08-08 | References link under responses; `#`-mentions with file + line; custom-instructions file surfaced as a reference |
| VS Code "Add context to chat" | code.visualstudio.com/docs/chat/copilot-chat-context | 2026-08-08 | `#file`, `#codebase`, `#fetch` context variables; implicit active-file/selection context |
| CodeRabbit Change Stack | docs.coderabbit.ai/pr-reviews/change-stack | 2026-08-08 | **Range-anchored summaries**: every layer/cohort anchors to exact diff line ranges; click-to-lookup symbol definitions (Code Peek); keyboard navigation |
| CodeRabbit Architecture | docs.coderabbit.ai/overview/architecture | 2026-08-08 | Multi-agent system; specialized Review/Verification/Chat agents; living memory |
| CodeRabbit docs index | docs.coderabbit.ai/llms.txt | 2026-08-08 | PR Walkthroughs, PR Summaries, Change Stack surfaces |
| Qodo — Chat with Qodo in PRs | docs.qodo.ai/code-review/chat-with-qodo-in-your-pull-requests/ | 2026-08-08 | Conversation scope is location-anchored (finding / line / PR); natural-language "explain this finding" |
| Sourcegraph Cody — Chat | docs.sourcegraph.com/cody/capabilities/chat | 2026-08-08 | Cody "tells you which code files it reads"; `@`-mentions for file, line range, symbol, remote repo; default context chips |
| Claude Code — permissions | code.claude.com/docs/en/permissions | 2026-08-08 | Command explanations with risk labels on demand (Ctrl+E); tool-call transparency as a trust pattern |

Note: No product was installed or exercised on this runner. In-product rendering details beyond what public docs state are labelled as inference. GitHub Copilot's reference UI ("Used *n* references" dropdown, References link) is documented behavior across the VS Code, Visual Studio, JetBrains, and Xcode pages fetched above.

---

## Observed Product Behavior

### GitHub Copilot Chat (VS Code / Visual Studio / JetBrains / Xcode)
- **References are shown as a list, not inline.** After a response, Copilot Chat shows a "**Used *n* references**" dropdown (VS Code) or a "**References**" link (Visual Studio, JetBrains, Xcode) that lists the files the model used to generate the response. The list is *below/above* the answer, not woven into the prose.
- **Explicit file references are user-supplied.** Developers add context with `#`-mentions: `#file:name`, `#file:name:12-20` (line ranges), `#codebase`, `#fetch <url>`. The active file and selection are included implicitly.
- **References are clickable jump targets.** Clicking a reference opens the file at the relevant location in the editor — the citation is a navigation affordance, not just a label.
- **Custom instructions files appear in the references list**, surfacing "what shaped this answer" as a reference the user can open and inspect.
- **No inline citation chips in the prose.** Copilot Chat does not (per the fetched docs) render per-sentence `file:line` chips inside the answer text. Grounding is communicated as a post-hoc reference panel.

### CodeRabbit (PR review platform)
- **Range-anchored summaries.** CodeRabbit's Change Stack organizes a PR into cohorts and layers; "Every layer anchors to specific line ranges in the diff, each with its own summary." The explanation is bound to the exact lines it describes.
- **Right-panel per-range summaries** sit beside the diff; each range summary has an "Add block comment" action that comments against the exact line range.
- **Code Peek:** clicking a variable, function, class, or type name in the diff "looks up its definition and usages" — citations that *resolve* to definitions rather than just naming a location.
- **Snapshots and stale-state protection:** if the PR changes while reviewing, commenting is disabled and a banner shows until a new snapshot is generated — citations never point at a diff that no longer matches the branch tip.
- **Keyboard navigation:** J/K move between layers; Z toggles focus. Citations are navigable without a mouse.

### Qodo (PR review)
- **Conversation scope is location-anchored.** Chatting from an inline finding scopes the conversation to that finding; inline comments scope to the specific line; PR comments scope to the whole PR. "Qodo uses the chat location to understand context."
- **Natural-language citation semantics.** Asking "why is this flagged" returns an answer tied to the anchored location (e.g. "the returned object is an array, but the code accesses it as a single value **on line 42**"). The citation is conversational, not a separate panel.

### Sourcegraph Cody
- **Transparency of retrieval.** "When Cody retrieves context to answer a question, it will tell you which code files it reads to generate its response." Retrieval sources are disclosed, not hidden.
- **Explicit context chips.** `@`-mentions produce context chips for repository, file, line range, or symbol; default chips for the open file and repo are visible and editable before asking.
- **Sourcegraph search integration** means file references can resolve against both local and remote codebases.

### Claude Code (agentic CLI) — adjacent trust pattern
- **Explainable tool calls on demand.** Pressing `Ctrl+E` on a Bash permission prompt shows "an explanation of the command: what it does, why Claude is running it, and what could go wrong," labelled **Low risk / Med risk / High risk**. Explanations are computed only when requested — a deliberate cost/privacy tradeoff.
- This is *tool-call* transparency rather than *source citation*, but it validates the pattern of **on-demand, labelled explanation** as a trust mechanism for AI output.

---

## User Problem Addressed

AI code explanations are only as trustworthy as the evidence behind them. A developer reading "this function validates the token" needs to know *which function, in which file, at which lines* — and needs to be able to jump there and verify with their own eyes. Without grounded, verifiable references, an explanation is unverifiable prose and can't support Unvibe's core promise (understand before you trust the AI's code). Competitors converge on two mechanics:

1. **Show the sources used** (Copilot's references list, Cody's "files I read", Claude Code's on-demand explanation).
2. **Anchor the explanation to exact line ranges** (CodeRabbit's range summaries, Qodo's location-scoped chat).

Neither is a comprehension feature by itself — but both are the raw material Unvibe needs: a citation chip is only meaningful if it is (a) truthful (only references actually in the context), (b) verifiable (clickable to the real location), and (c) stable (never pointing at a stale or invented file).

---

## Why It May Work (or Not)

### Why Unvibe's inline-chip approach may work
1. **Inline citation chips are a differentiation, not a commodity.** Copilot hides references behind a dropdown; Qodo anchors conversation scope but doesn't render inline chips in prose. Unvibe's `[[cite:FILE:LINE]]` chips inside the explanation text are closer to academic/grounded-generation conventions than any fetched competitor.
2. **Chips pair naturally with streaming.** Unvibe already strips incomplete `[[cite:...]]` markers during streaming (richText.tsx) so chips appear only when complete — a clean, tested pattern.
3. **CodeRabbit proves line-range anchoring is expected.** Reviewers now expect explanations bound to exact ranges; Unvibe's diff-hunk context already carries that information.
4. **Privacy stance is a strength here.** Unvibe sends only filtered context and instructs the model to cite only real files from that context — the anti-hallucination contract (web/src/ai/prompt.ts) directly supports citation truthfulness, which competitors cannot always claim.

### Why it may not work
1. **Chips are currently display-only.** Unvibe's `.cite` chips render as non-interactive spans (richText.tsx:75-81) with only a `title` tooltip. Against Copilot's clickable references and CodeRabbit's Code Peek, a non-clickable chip may read as decorative rather than trustworthy — worse than no chip if the developer can't verify.
2. **Model compliance is unmeasured.** The prompt instructs `[[cite:FILE:LINE]]` usage, but no test verifies that real responses cite accurately, cite only context files, and never invent locations. A hallucinated line number is more damaging than no citation.
3. **Chips in flowing prose can clutter a widget.** Five-level explanations at Beginner/New level may need fewer, gentler references; a wall of chips is noise for a new learner.
4. **Stale references.** Unvibe's diff review can outlive the working tree it described; unlike CodeRabbit's snapshot protection, there's no mechanism to invalidate a citation when the code changes underneath it.

---

## Limitations (as of August 2026)

- **GitHub Copilot Chat**: references are shown as a post-hoc list, not inline chips; exact visual rendering of the dropdown is documented but the degree of per-line anchoring is not stated.
- **CodeRabbit**: Change Stack is early-access and Pro+; its citation model is diff-range-based, not explanation-prose-based — the closest structural analogue to Unvibe's line-anchored context, but a different surface (review UI vs overlay widget).
- **Qodo**: location-scoped chat is strong but conversational; no evidence of inline citation chips in prose.
- **Cody**: discloses retrieved files but does not, in fetched docs, tie individual claims to individual file+line references.
- **Claude Code**: risk labels are on tool calls, not on code claims; directly useful only as a trust-UX precedent.
- **All**: none offer Unvibe's combination of level-adapted explanation + inline verifiable citations + comprehension check. That combination remains open space.

---

## What Unvibe Can Learn

1. **Make chips clickable and resolvable (highest-value change).** The `.cite` chip currently has a `title` tooltip only. Given Copilot's references are clickable and CodeRabbit's Code Peek resolves symbols, Unvibe should make chips open the cited file at the cited line in the user's editor (via the main-process bridge — the widget renderer never touches the filesystem directly, preserving the I/O rule). This converts a decoration into a verification affordance.
2. **Always show the sources used.** Even without inline clicks, a small "sources: file:line, file:line" footer per explanation mirrors Copilot's references list and Cody's "files I read" — cheap, honest, trust-building.
3. **Anchored scopes already exist; surface them.** Unvibe's `ReviewContext` carries `selection.file/startLine/endLine` and `diffHunks` with exact ranges. The chip system already encodes ranges (`FILE:START-END`); making range coverage explicit in the UI (e.g. hover shows the span) matches CodeRabbit's range summaries.
4. **Validate citation truthfulness in the AI eval.** Add an eval case: does the model cite only files present in context, and are line numbers within range? This is the anti-hallucination contract made measurable.
5. **Level-appropriate citation density.** Beginner/New explanations should cite sparsely ("the function on line 12"); Expert explanations can cite densely. The prompt already varies level guidance; add explicit citation-density guidance per level.
6. **On-demand explanation as a trust pattern (Claude Code's Ctrl+E).** For Unvibe's "Test me" and follow-up answers, offer an optional "why did it answer this?" that shows the sources consulted — cheap, privacy-preserving (computed only when asked).
7. **Stale-reference handling.** If a widget explanation is pinned and the underlying file is edited after the review, mark the citation as "may be out of date" rather than silently linking to changed code.

---

## What Unvibe Should Avoid Copying

1. **Do not copy CodeRabbit's Change Stack layout, cohorts/layers terminology, or its three-panel review UI.** That is a full review product surface, not an overlay widget. The line-range *concept* is adoptable; the layout is not.
2. **Do not copy Copilot's `#`-mention grammar or its reference-dropdown styling.** Unvibe's `[[cite:...]]` marker grammar is already wired end-to-end; keep it.
3. **No fabricated citations.** Never render a chip for a file the model invented; the prompt already forbids it — keep that rule hard and test it.
4. **No separate reference panel as the primary mechanism.** Unvibe's widget is small; burying evidence in a dropdown would dilute the in-prose grounding. Inline chips + optional footer, not a panel-first model.
5. **No "risk labels" copied wholesale.** Claude Code's Low/Med/High risk tags are for command execution; applying them to code claims would imply a severity model Unvibe doesn't have and shouldn't fake.

---

## Original Unvibe Interpretation

Competitors treat citations as either (a) a post-hoc reference list (Copilot, Cody) or (b) an anchoring device for a review surface (CodeRabbit, Qodo). Unvibe's interpretation: **the citation is a first-class part of the explanation prose, rendered inline as a calm chip, clickable for verification, and truthful by contract.** The widget is small, so evidence must live *where the claim is made*, not in a separate panel. Verification is a single click to the real file — because the point of the product is "understand before you trust," and understanding requires the developer to be able to check.

Unvibe's differentiation is the combination no fetched competitor has: **level-adapted explanation + inline verifiable citations + a comprehension check** — all in a floating overlay that never sends unfiltered code anywhere.

---

## Expected User Benefit

- A developer reading an explanation can click any chip and land on the exact code being described — verification becomes one click instead of a guess.
- Trust in explanations rises because every claim is traceable to a real location, and the privacy contract (cite only filtered context) stays intact.
- Beginners get sparse, gentle references; experts get dense, precise ones — citation density adapts to the level like the prose already does.
- The "Test me" loop gains integrity: a comprehension question whose rationale points at the exact lines being tested is more honest and more learnable.

---

## Technical Difficulty

| Component | Difficulty | Notes |
|---|---|---|
| Clickable chips → open file at line | Low-Med | Needs a main-process IPC handler (`openPath`-style) + editor association; renderer never touches FS (preserves the I/O rule) |
| Sources footer ("from file:line, file:line") | Low | Reuse existing `StreamEvent`/state; render from known context ranges |
| Citation-truthfulness eval case | Low-Med | Add to AI eval: only-context files, in-range lines, no invented files |
| Level-appropriate citation density in prompt | Low | Small prompt change + label in prompt.ts |
| Stale-reference detection (file edited since review) | Medium | Compare file mtime/line count at render time via main process; new IPC surface |
| On-demand "why did it answer this?" (sources consulted) | Medium | Store consulted ranges per review; compute only when requested |
| Snapshot-style invalidation (CodeRabbit-grade) | Medium-Hard | Overkill for v1; recommend deferring |

---

## Security and Privacy Considerations

- **No new data surface.** Citations reference files/lines already in the filtered `ReviewContext`; nothing new leaves the machine.
- **Renderer stays I/O-free.** Any click-to-open must be a main-process IPC call, preserving the rule that the widget renderer cannot touch the filesystem directly (mirrors the no-network-from-webview rule).
- **No credentials, no paths beyond the repo.** Cite chips show basenames (already handled by `citeLabel`); full paths stay in the main process.
- **Truthfulness is a privacy+trust requirement.** A citation that names a file not in the context would imply the model saw more than was sent — which would be false. The "cite only provided context" rule must remain enforced and tested.
- **No training, no logging of clicked citations unless opted-in.** Click-throughs could later feed metadata-only learning analytics, but only with explicit consent, per existing metadata-only logging policy.

---

## Smallest Validation Experiment

Ship **clickable chips + a sources footer** behind the existing widget (no new surface), then run a 2-week measurement:

1. % of explanations where the developer clicks at least one chip (verification rate)
2. Time-to-verify: time between "I understand" click and any chip click
3. % of "Test me" answers answered correctly *after* the developer verified a citation vs. without
4. Citation accuracy spot-check: run the eval case on a sample of N real reviews; record % of citations referencing in-context files only and in-range lines

Hypothesis: developers who click a chip are more likely to answer the comprehension question correctly — i.e., *verifiable citations improve measured comprehension*, which is exactly Unvibe's core claim. If true, the clickable-citation investment is validated by the product's own learning loop.

---

## v1, v2, or Later Recommendation

| Pattern | Recommendation | Rationale |
|---|---|---|
| Clickable chips (open file at line via IPC) | **v1** | Directly supports "understand before you trust"; small, self-contained change |
| Sources footer per explanation | **v1** | Cheap, honest, mirrors Copilot/Cody expectations |
| Citation-truthfulness eval case | **v1** | Makes the anti-hallucination contract measurable |
| Level-appropriate citation density | **v1** | Prompt-only change; matches existing 5-level guidance |
| On-demand "why did it answer this?" | **v2** | Claude Code Ctrl+E precedent; needs stored consulted-ranges model |
| Stale-reference detection | **v2** | Needs mtime/line-count IPC surface; safety net once pins exist |
| Snapshot-style invalidation | **later** | Review-product concern; overkill for the overlay |

---

## Key Takeaways

1. **Competitors converge on two citation mechanics — show the sources used, and anchor claims to line ranges — but none combine them with leveled, in-prose chips.**
2. **Unvibe's inline-chip design is differentiated but currently display-only.** Non-clickable chips risk reading as decoration; making them click-to-verify directly serves the product thesis.
3. **Citation truthfulness must be tested, not assumed.** The prompt contract already says "cite only provided context"; an eval case makes it measurable and keeps the privacy story honest.
4. **Citation density should adapt to level** the way the prose already does — sparse for New/Beginner, dense for Advanced/Expert.
5. **Renderer stays I/O-free.** Clickable citations go through the main process; no new trust boundary is introduced.
