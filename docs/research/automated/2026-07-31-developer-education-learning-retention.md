# Research Report: Developer Education and Learning Retention — Comprehension Checks, Mastery, and Spaced Reinforcement

**Date:** 2026-07-31
**Mission:** competitor-research-and-v2
**Researcher:** OpenCode Night Lab (automated)
**Sources:** Public product pages, public product blog posts, published learning-science literature review (fetched 2026-07-31)
**Gap filled:** Prior night-lab reports covered code-explanation tools, AI code review, and desktop overlays (2026-07-24 through 2026-07-28). None examined how *developer-education* products design comprehension checks, mastery tracking, and retention — the exact domain of Unvibe's "Test me" loop, skill states, review queue, and v2 Study/Concepts pages.

---

## Research Question

How do developer-education and language-learning products structure comprehension checks, mastery/level progression, and spaced reinforcement — and which patterns should Unvibe adopt, adapt, or avoid for its own learning loop (review → quiz → skill state → review queue)?

---

## Dated Sources

| Source | URL | Date accessed | What it informed |
|---|---|---|---|
| Exercism — About / purpose & principles | exercism.org/about | 2026-07-31 | Mastery framing, journey-over-facts philosophy, mentoring |
| Jiki — product page | jiki.io | 2026-07-31 | LLM-era code learning; levels; "read code, not write code" thesis |
| Jiki — "The Backstory of Jiki" (Jeremy Walker) | jiki.io/blog/the-backstory-of-jiki | 2026-07-31 | Design rationale: learning by building, foot-gun removal, pacing |
| Jiki — "Should I still learn to code in 2026?" | jiki.io/blog/should-i-still-learn-to-code-in-2026 | 2026-07-31 | The reading-code-over-writing-code argument; retention framing |
| Pluralsight — Skills product page | pluralsight.com/product/skills | 2026-07-31 | Skill IQ assessment, learning paths, reassessment, hands-on labs |
| Gwern — "Spaced Repetition for Efficient Learning" (literature review) | gwern.net/spaced-repetition | 2026-07-31 | Spacing effect, testing effect, forgetting curve, SRS design evidence |

Note: Duolingo's engineering-blog URLs 404'd on fetch; Duolingo observations below are therefore limited to what other dated sources corroborate and are labelled as such. No Duolingo claims are treated as verified here.

---

## Observed Product Behavior

### Exercism (exercism.org)
- **Mastery framing**: "We're here to help everyone get really good at programming." Purpose pillar #1 is literally "Attain mastery."
- **Learning journey over facts**: "Exercism focuses on the learning journey, not the destination. The process and enjoyment of learning is more important than absolute factual correctness."
- **Practice + mentoring**: language "tracks" of exercises, plus human mentoring (384,906 mentoring sessions). Mentoring, not grading, is the feedback loop.
- **Journey/evidence UI**: a "Journey" page aggregates solved exercises into a personal timeline.
- **New beginners path**: the team spun off a separate product (Jiki) for total beginners rather than force-fitting Exercism — 500+ beginner signups/day were leaving because Exercism wasn't built for them.

### Jiki (jiki.io — Exercism founder's LLM-era learn-to-code product)
- **Core 2026 thesis**: "Getting good at writing code is becoming irrelevant… most of your work is going to be reading code, not writing it." Learning to *read and verify* code is the retained skill. This is the same problem Unvibe addresses, from the education side.
- **Levels**: curriculum structured in ~20 levels, "students normally take 1-2 weeks per level," each unlocking more language features (foot-guns disabled until the learner is ready — e.g. `var` and arrow functions blocked early).
- **Progressive feature enablement**: custom interpreters strip "foot-guns" — learners can't misuse features they haven't earned yet. A literal, enforced progression gate.
- **Learning by building**: "You learn by making stuff" — projects from day one (games, animations), not five-line exercises. The design hypothesis is that making real things drives retention.
- **Two strands**: "Learn to Code" (fundamentals, free) + "Learn to Build in the LLM Era" (how the web works, databases, auth, guiding an LLM safely; premium).
- **Pacing lesson (self-reported)**: the 2025 bootcamp was "way too fast"; Jiki deliberately added more, slower exercises. Learners who find it easy "shoot through"; strugglers get life-saver exercises.
- **Pricing**: freemium — core free; premium $/mo (PPP-adjusted) for AI support, bonus projects, livestreams, certificates. "I almost never write code now. I let the LLMs do it for me" is the founder's stated daily practice.

### Pluralsight (pluralsight.com)
- **Skill IQ**: "Benchmark skills with over 500 skill assessments." Assessment produces a personalized *skill score* (0–300 range historically) per domain.
- **Reassessment loop**: "Reassessing over time shows how your skills improve as you complete courses" — the assessment is repeated, not one-shot.
- **Gap closure**: assessment → "identify gaps" → recommended learning paths → content → reassess. Assessment drives content recommendation.
- **Hands-on validation**: 3,500+ hands-on labs and sandboxes; certification prep with practice exams ("test-ready"). In-the-moment feedback on practice.
- **AI layer**: "Iris AI — your AI assistant throughout the learning journey."

### Spaced-repetition / learning-science literature (Gwern's review)
- **Spacing effect**: two spaced presentations ≈ twice as effective as two massed presentations; benefits grow with more repetitions. Widely replicated since Ebbinghaus (1885).
- **Testing effect**: retrieval practice beats re-reading/elaborative studying for long-term retention (Karpicke & Blunt 2011, Science; Roediger & Karpicke 2006). Testing is a *learning* event, not just an assessment.
- **Forgetting curve**: knowledge decays steeply without review (CPR skill example: 2.4% retained at 3 years). Interval expansion (e.g. 1→3→7→14→30 days) keeps memories alive with fewer total reviews.
- **Metacognitive illusion**: learners systematically *believe* massed/crammed study is better even when spaced study outperforms it (Kornell 2009: 72% preferred massing, though spacing won for 90% of participants). Products must therefore not rely on learners self-selecting spacing — the system must schedule it.
- **Habit dropout is brutal**: one SRS web startup reported ~4,000 users finished one session but fewer than 20 (~0.5%) did more than one. Retention mechanics matter more than the scheduling algorithm.
- **Interval practice in code**: works for vocabulary/facts; the literature's coverage of *conceptual* or *procedural* knowledge is weaker — an honest limitation for a code-comprehension product.

---

## User Problem Addressed

**For the learner who uses AI to write code:** AI generates code faster than the developer can absorb it. Education products (Exercism/Jiki/Pluralsight) prove there is demand for structured, progressive, verified learning — but they live in dedicated apps, disconnected from the code the developer actually encounters. Unvibe's loop (review → "Test me" → skill state → spaced revisit) is the same learning science applied *at the moment of exposure to AI-written code*, which is where the comprehension gap actually opens.

Jiki's 2026 thesis is the strongest external validation of Unvibe's premise: the skill that matters now is *reading and verifying* code, not writing it — exactly what Unvibe's explanation loop trains.

---

## Why It May Work (or Not)

### Why Unvibe's learning loop may work
1. **The spacing/testing evidence is robust.** The review queue (1/3/7/14d) and quiz cards map directly onto the best-established findings in the learning literature (spacing effect, testing effect). Unvibe is applying validated science, not a guess.
2. **"Test me" is the testing effect, productized.** Retrieval practice strengthens memory better than re-reading — a quiz card is a retrieval event. Education competitors prove users tolerate quizzes; no code-explanation tool offers one.
3. **Leveled progression has a working precedent.** Jiki's levels and Pluralsight's Skill IQ both show developers accept staged progression with gated content. Unvibe's 5 levels map onto a familiar, validated pattern.
4. **The moment-of-exposure placement is unique.** Exercism/Jiki require leaving your work to go practice. Unvibe teaches in place, at the diff.

### Why it may not work
1. **Habit dropout.** The SRS startup anecdote (~0.5% second-session retention) is a warning: a review queue nobody opens is worthless. Unvibe's overlay is well-placed (low friction), but *returning* to a queue is a different behavior from answering a card in the moment.
2. **Conceptual vs. factual retention.** The literature is strongest for discrete facts (vocab, capitals). Code comprehension is conceptual/procedural; the transfer of spacing benefits is plausible but less directly evidenced.
3. **Metacognitive illusion cuts both ways.** Learners who believe cramming works will also believe a quiz card "feels" too easy/hard; Unvibe cannot rely on self-reported understanding — it needs the objective quiz outcome, which it already records.
4. **Comprehension testing at scale requires quality questions.** A bad quiz question erodes trust fast. Education products invest heavily in content; Unvibe generates questions per-diff via AI, which is a quality risk (see AI eval requirements).

---

## Limitations (as of July 2026)

- **Exercism/Jiki**: structured curriculum learning; not connected to the user's own AI-generated code; mastery is track-based, not concept-based. No overlay/in-place experience.
- **Pluralsight**: assessment + reassessment loop is solid, but entirely a destination app; Skill IQ is self-contained, not connected to a developer's daily work.
- **Jiki specifically**: beginner-focused ("This isn't designed for you" to experienced devs); no comprehension-check mechanics described publicly; no spaced-review scheduling in public materials.
- **SRS tools generally**: built for factual flashcards (Anki/Mnemosyne); no code-specific comprehension or skill-state model; none cite code as the learning material.
- **Duolingo**: known publicly for streaks and the spaced-repetition-inspired lesson schedule, but its engineering-blog posts 404'd from this runner; no first-party claims are relied on here.
- **All**: none verify *understanding of AI-generated code* at the point of exposure. That remains open space for Unvibe.

---

## What Unvibe Can Learn

1. **Make the review queue non-negotiable — but gentle.** The interval expansion already in `computeReviewQueue` (1/3/7/14d) matches the literature. The risk is not the algorithm, it's the habit. Learn from Jiki's pacing lesson: default to *fewer, easier* reviews and let fast learners opt into more.
2. **Assess → recommend → reassess (Pluralsight loop).** Pluralsight's strongest pattern is the closed loop: assessment scores a gap, content closes it, reassessment proves progress. Unvibe's skill states already produce "Needs review" signals; connecting them to a recommended Study action ("This concept is due — 2 min") mirrors the loop without copying it.
3. **Gate content by demonstrated understanding (Jiki's foot-gun removal).** Jiki disables language features until the learner earns them. Unvibe's analogue: keep the "Advanced/Expert" explanation level *locked* until the user passes an intermediate-level "Test me" on that concept. Progressive feature enablement is a strong, education-validated pattern.
4. **Levels as a time budget, not a label.** Jiki says students take 1–2 weeks per level. Unvibe shouldn't copy that pacing, but the insight transfers: level changes should be rare and meaningful, not per-explanation.
5. **Separate the audience, don't force-fit (Exercism → Jiki).** Exercism split beginners into a new product rather than degrading the expert experience. Unvibe already has per-review level choice; the lesson is to keep the "New/Beginner" path clearly distinct from the "Advanced/Expert" path in Study/Concepts, not to merge them into one average flow.
6. **Show the evidence map honestly.** Unvibe's "cautious labels" (developing/familiar/strong/needs review) are already more calibrated than Pluralsight's single score. Keep it: an evidence-based label with a visible evidence trail is a differentiator, not a compromise.
7. **The reading-code thesis is a marketing gift.** Jiki's public writing ("you need to read code well enough to catch the mistakes LLMs confidently make") is independent, dated, public validation of Unvibe's core premise — usable as market context (cite, don't copy).

---

## What Unvibe Should Avoid Copying

1. **Do not copy Jiki/Exercism branding, layout, level art, or wording.** No copied hats/characters, navigation, or marketing lines. The Unvibe design system (black/white/restrained grays, no gradients) stays.
2. **No streak-style gamification by default.** Streak/heat is already present in Unvibe's Profile; the SRS-dropout evidence warns against making streaks the primary retention lever. Keep streaks as a *quiet signal*, not a nag.
3. **No hardcoded "mastery percentages."** Pluralsight's 0–300 Skill IQ is a marketing score. Unvibe's skill states are event-derived; keep them event-derived and never fake precision.
4. **No forced lockouts.** Jiki's foot-gun removal works because it's a controlled curriculum. Unvibe must never *block* a user from an explanation level or a concept they need — gating should be a gentle suggestion, not a hard wall (unless the user opts into "study mode").
5. **Do not become a destination learning app.** Exercism/Pluralsight own a separate learning surface. Unvibe's value is the overlay + in-place loop; copying the "go practice in our app" model would abandon the differentiation.

---

## Original Unvibe Interpretation

The education market's pattern is **"structured curriculum → practice → assessment → reassessment"** inside a dedicated app. Unvibe's interpretation is that this loop must be **inverted and made ambient**: the curriculum is the developer's own repository, the practice is reviewing a just-made diff, the assessment is a single well-placed "Test me" card, and reassessment is a 1/3/7/14-day revisit that appears in a floating widget rather than a calendar.

Unvibe's differentiation is not the learning science (everyone can read the same literature) — it is **placement**. Jiki teaches reading code in a classroom-like setting; Unvibe teaches it at the exact moment the AI's code lands in front of you. The education products validate the loop; the overlay validates the delivery.

---

## Expected User Benefit

- Developers get retention from AI-generated code: instead of "read it once, forget it," a 2-minute revisit 3 days later makes the concept stick (spacing effect).
- A junior developer gets level-appropriate explanations and a quiz that confirms (or honestly flags) understanding before moving on — the same value Exercism's mentoring provides, but for code they didn't write.
- A senior developer gets a quiet, due-item signal for concepts they flagged "needs review," without leaving their workflow.
- The dashboard (Study/Concepts/Profile) becomes a truthful evidence map of what was reviewed, understood, and retained — the reassessment loop Pluralsight charges for, derived from the user's actual work.

---

## Technical Difficulty

| Component | Difficulty | Notes |
|---|---|---|
| Spaced review queue (1/3/7/14d) | Low | Already implemented in `app/src/core/learning.ts` (`computeReviewQueue`) |
| Quiz cards ("Test me") | Medium | Already implemented (`app/src/main/studyQuiz.ts`); quality is the open risk |
| Skill states (New→Strong) | Low | Already implemented (`deriveSkillState`); calibration data still needed |
| Adaptive quiz level (stretch up / ease down) | Medium | Already implemented (`adaptiveQuizLevel`) |
| Level gating by demonstrated understanding | Medium | New; needs a "locked level" UX that never hard-blocks |
| Concept-level revisit scheduling | Medium | Needs concept→due-item mapping in the Study queue |
| Retention *measurement* (did retention actually improve?) | Medium-Hard | Requires longitudinal event data; no claim without it |

Unvibe already implements the core of the loop. The recommended work is **closing the loop** (connect quiz outcomes to the queue and to level gating) rather than building new learning science.

---

## Security and Privacy Considerations

- No new data surfaces: everything above uses existing `LocalEvent` records (outcome, concept, level, ts). Lesson bodies (`code`, `explanation`) stay on-device per `forSync` (learning.ts:80).
- Quiz generation sends only the review payload (code excerpt + level + quiz mode) to the backend — consistent with existing secret-filter-before-send behavior; no change in trust boundary.
- Retention measurement must be **event-count based**, not a fabricated percentage. No arbitrary mastery percentages (matches AGENTS.md rule and the 2026-07-28 report's finding).
- Never claim Unvibe "knows what the user understands"; label states as evidence-derived ("cautious labels" already do this).

---

## Smallest Validation Experiment

Ship the *loop closure*, not new science: when a user answers a quiz card **wrong**, put that lesson at the top of the Study queue with a "Revisit today — 1 min" label (this already happens via `needs_review`); when answered **right**, keep the existing 1/3/7/14d schedule. Then measure, over 2 weeks:

1. % of wrong-answer lessons actually revisited (vs. abandoned)
2. % of revisited lessons answered correctly on the second pass
3. Revisit rate vs. the ~0.5% second-session dropout seen in generic SRS
4. Whether "Needs review" items convert to "Familiar/Strong" at a higher rate when surfaced in the floating bar vs. only in the companion Study page

Hypothesis: in-place revisits (floating widget) outperform companion-only revisits. If true, that justifies the overlay-first delivery model over the destination-app model.

---

## v1, v2, or Later Recommendation

| Pattern | Recommendation | Rationale |
|---|---|---|
| Queue loop closure (wrong→revisit, right→schedule) | **v1** | Already mostly built; completes the validated learning loop |
| Quiz quality eval | **v1** | The make-or-break input; needs AI eval, not just unit tests |
| Level gating by demonstrated understanding | **v2** | Strong pattern (Jiki), but needs UX care and user opt-in |
| Concept-level due scheduling | **v2** | Requires concept extraction maturity |
| Retention measurement/reporting | **v2** | Needs longitudinal data; never claim retention without it |
| Reassessment-dashboard (Pluralsight-style) | **v2** | The Study/Concepts pages are the right home; avoid a destination-app trap |
| Audience split (Beginner vs. Advanced paths) | **v2** | Exercism→Jiki lesson; keep paths distinct in the companion, not merged |
| Gamification beyond quiet streaks | **later** | Dropout evidence says streaks don't retain; revisit only with real data |

---

## Key Takeaways

1. **Unvibe is already implementing the education market's validated loop** (spaced queue, quiz, skill states) — the opportunity is closing the loop, not inventing it.
2. **Jiki's public 2026 thesis is independent validation of Unvibe's premise**: the skill that matters is reading/verifying AI-generated code.
3. **The spacing and testing effects are the strongest evidence in learning science** and map one-to-one onto Unvibe's existing features.
4. **The biggest risk is habit dropout (~0.5% second-session retention in SRS)**, not the scheduling algorithm — the in-place floating widget is the right counter, but must be measured.
5. **Mastery labels must stay evidence-derived and never fabricated** — this is both an ethics rule (AGENTS.md) and a differentiator against marketing-score competitors.
6. **Education competitors validate the loop but live in destination apps**; Unvibe's overlay placement is the true differentiation, and it should not copy the destination-app model.
