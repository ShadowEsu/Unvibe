# Research Report: Developer Metacognition, Self-Assessment Accuracy, and the Illusion of Explanatory Depth in Code Comprehension

**Date:** 2026-08-05
**Mission:** competitor-research-and-v2
**Researcher:** OpenCode Night Lab (automated)
**Sources:** Public literature (Wikipedia survey pages, peer-reviewed studies, open-access ACM/arXiv papers) — fetched 2026-08-05
**Gap filled:** Prior night-lab reports covered the code-explanation landscape (2026-07-28), explanation levels (2026-07-28), AI change communication (2026-08-01), learning retention / spaced repetition (2026-07-31), and interruption/attention economics (2026-08-04). None examined **how accurately developers can assess their own understanding of (AI-generated) code** — the cognitive-science foundation for Unvibe's "Test me" loop and its "I understand" confirmations. If self-reports of understanding are systematically unreliable, the design of comprehension verification — not the explanation itself — becomes Unvibe's core product.

---

## Research Question

How accurate are developers' self-assessments of their own comprehension of code, and specifically of AI-generated code? What does the published evidence on the illusion of explanatory depth (IOED), the Dunning–Kruger effect, and metacognitive monitoring say about when "I understand" is trustworthy — and what should Unvibe's comprehension-check ("Test me") and "I understand" confirmations be designed to measure?

---

## Dated Sources

| Source | What it informed | Date accessed |
|---|---|---|
| Wikipedia, "Illusion of explanatory depth" (survey, cites Rozenblit & Keil 2002 et al.) | Definition, scope, original experiment, correction conditions | 2026-08-05 |
| Rozenblit & Keil, "The misunderstood limits of folk science: an illusion of explanatory depth," *Cognitive Science* 26(5) 2002 (open access, PMC3062901) | Original IOED experiment: ratings drop after generating an explanation | 2026-08-05 |
| Wikipedia, "Dunning–Kruger effect" (survey of Dunning & Kruger 1999 and critiques) | Definition, measurement, metacognitive vs. statistical explanations, practical significance | 2026-08-05 |
| Wikipedia, "Metacognition" (survey) | Monitoring vs. control; metacognitive bias/sensitivity/efficiency; confidence-accuracy relation | 2026-08-05 |
| Chromik, Eiband, Buchner, Krüger & Butz, "I Think I Get Your Point, AI! The Illusion of Explanatory Depth in Explainable AI," *IUI* 2021 | IOED demonstrated with AI explanations specifically | 2026-08-05 |
| He, Aishwarya & Gadiraju, "Is Conversational XAI All You Need? ..." *IUI* 2025 (arXiv:2501.17546) | Conversational XAI raises trust but causes overreliance; authors attribute it to IOED | 2026-08-05 |
| Lehtinen, Santos & Sorva, "Let's Ask Students About Their Programs, Automatically," *ICPC* 2021 (arXiv:2103.11138) | Working code ≠ understood code; auto-generated questions as comprehension probes | 2026-08-05 |
| Rahe & Maalej, "How Do Programming Students Use Generative AI?" *FSE* 2025 (arXiv:2501.10091) | Students over-rely on GenAI; "submit broken code, ask for fix" loop; agency loss | 2026-08-05 |
| Rojas-Galeano, Tejada & Marmolejo-Ramos, "Between Tool and Trouble: Student Attitudes Toward AI in Programming Education," 2025 (arXiv:2508.05999) | AI perceived as helpful/confidence-boosting but transfer to unaided tasks weakens | 2026-08-05 |
| Elnaffar, Rashidi & Abualkishik, "Teaching with AI: A Systematic Review ... Programming Education," 2025 (arXiv:2510.03884) | Overreliance → superficial learning reported in ~65% of surveyed studies | 2026-08-05 |
| Hossain, Shayoni, Mridha & Shin, "EduGuard: A Safe RAG-Based LLM Tutor," 2026 (arXiv:2607.15738) | Tutoring with verification + overreliance control cut overreliance ~38% → 17% vs. plain tutor | 2026-08-05 |
| Lekshmi-Narayanan, Hassany & Brusilovsky, "LLMs for Automated Assessment of Student Self-Explanations," 2026 (arXiv:2605.21614) | Self-explanation (not passive study) is the enhancement mechanism; LLM scoring of free-text explanations is feasible | 2026-08-05 |

---

## Observed Behavior and Evidence

### 1. The Illusion of Explanatory Depth (Rozenblit & Keil 2002; Wikipedia survey)
- People believe they understand a topic better than they do, specifically for **explanatory knowledge** — "knowledge that involves complex causal patterns." The effect was **not** observed for procedural, narrative, or factual/descriptive knowledge.
- Original experiment: 16 Yale undergraduates rated their understanding of everyday devices, were then asked to generate a detailed explanation of how the devices worked, and re-rated. **Ratings dropped after generating the explanation** — attempting to explain confronts people with the reality that they understand less than they thought.
- The effect is reduced in experts but "believed to affect almost everyone"; it is stronger where knowing the topic is socially desirable.
- **Correction condition:** asking people to *explain* a topic (rather than justify a position or give reasons) reduces the illusion. This is the single most actionable finding for Unvibe.

### 2. IOED extends to AI explanations (Chromik et al., IUI 2021)
- Chromik et al. demonstrated IOED in the context of explainable AI: users believe they understand an AI's explanation (why it made a decision) better than they actually do. The illusion is "concomitant with XAI interfaces" — a general, expected failure mode of explanation displays, not a fixable display bug.

### 3. Conversational AI explanations raise trust but not verified understanding (He et al., IUI 2025)
- A conversational XAI interface produced **better self-reported understanding and higher trust** than a dashboard.
- However, **both** interfaces produced clear overreliance, and **LLM-agent-powered conversations amplified overreliance**.
- Authors explicitly reason that the cause is the illusion of explanatory depth. Implication: a fluent, conversational explanation can *increase confidence without increasing verified comprehension*.

### 4. Dunning–Kruger and the reliability of self-assessment (Dunning & Kruger 1999; Wikipedia survey)
- Low performers systematically overestimate their ability; self-assessment correlates only weakly with objective performance, most weakly for the bottom quartile.
- Metacognitive explanation (low performers can't perceive their own gaps) vs. statistical critique (regression to the mean + better-than-average effect may account for much of the pattern; some researchers argue the effect is largely an artifact).
- Both sides agree: **self-assessment is an unreliable proxy for objective performance**, and the best way to improve self-assessment accuracy is to make people better performers or give them training/feedback (monetary incentives alone did not improve accuracy).
- Practical significance: inaccurate self-assessment leads people to make decisions on a false basis; the harms are asymmetric (overconfidence in planning; underconfidence for experts).

### 5. Metacognitive monitoring vs. control (Wikipedia survey)
- Metacognition = monitoring (judging the strength of one's knowledge) + control (using those judgments to steer behavior).
- Key empirical notes: "students often mistake a lack of effort for understanding"; "greater confidence in having performed well is associated with less accurate metacognitive judgment of the performance."
- Metacognitive bias (general over/underconfidence), sensitivity (does confidence distinguish correct from incorrect), and efficiency are distinct measurable quantities.

### 6. Working code ≠ understood code, in the AI era
- Lehtinen et al. (ICPC 2021): "Students sometimes produce code that works but that its author does not comprehend" — passing automated functional tests does not guarantee understanding. They propose **auto-generated questions about the student's own program** as comprehension probes and self-explanation prompts.
- Rahe & Maalej (FSE 2025): when students used ChatGPT on a task requiring comprehension, most ended up prompting it to generate a full solution; many got trapped in a "vicious cycle of submitting wrong generated code and then asking the bot for a fix." Students who self-reported regular GenAI use were *more* likely to generate solutions rather than comprehend.
- Rojas-Galeano et al. (2025): AI tools were perceived as helpful "for understanding code and increasing confidence," yet students reported difficulty transferring knowledge to unaided tasks — consistent with IOED: perceived understanding rises while demonstrable understanding does not.
- Elnaffar et al. (2025) systematic review: overreliance and superficial learning are reported challenges in ~65% of the 58 surveyed studies; "confidence with shallow understanding" is a recognized pattern in AI-assisted programming education.
- EduGuard (2026): a tutor with explicit overreliance control + claim-level verification cut overreliance from ~38% (plain GPT tutor) to ~17% in a pilot — i.e., **verification and prompt design measurably reduce the illusion-driven overreliance**, not just the explanation content.

### 7. The correction mechanism: self-explanation (Lekshmi-Narayanan et al. 2026; Rozenblit & Keil 2002)
- Worked-example learning is enhanced when students *self-explain* each step rather than passively study it. This is exactly the Rozenblit & Keil result: generating an explanation is what collapses the illusion.
- LLM-based automated scoring of free-text student explanations is a feasible and increasingly competitive technique (vs. pure semantic-similarity baselines) — relevant to Unvibe's ability to grade a "Test me" short-answer or a follow-up user explanation.

---

## User Problem Addressed

Developers increasingly approve, ship, and build on AI-generated code they **believe** they understand. The literature shows three compounding failures:

1. **IOED**: reading a fluent explanation inflates perceived understanding without raising demonstrable understanding (Chromik; He et al.).
2. **Weak self-assessment**: "I understand" is an unreliable self-report, systematically biased for novices and for relative (vs. absolute) judgments (Dunning–Kruger).
3. **No verification surface**: working code, passing tests, and even a confident user are all poor proxies for comprehension (Lehtinen et al.).

Unvibe is uniquely positioned to add the missing **objective comprehension signal** — a check that distinguishes "I feel I get it" from "I can demonstrate it."

---

## Why This May Work (or Not)

**Why it may work:**
- The correction is cheap and well-supported: *ask the user to generate/explain*, and self-assessment calibrates downward (Rozenblit & Keil). A single well-built comprehension question or short self-explanation prompt is the smallest intervention with demonstrated effect.
- Verification surfaces are a genuine white space — no observed competitor (Copilot, Cursor, Devin, CodeRabbit, Sourcegraph) runs an understanding check.
- The IUI 2025 and EduGuard findings show the *problem* (overreliance) and the *fix* (verification/control) are both measurable, so Unvibe can A/B test its own claims.

**Why it may not work:**
- The Dunning–Kruger statistical critique means even objective quiz results are noisy; single-question measures are weak signals.
- Multiple-choice recognition questions test *recognition*, not *generation* — recognition is exactly the mode that flatters IOED. A purely multiple-choice "Test me" may re-inflate confidence.
- If the user can click "I understand" to dismiss the widget, the confirmation is gamed as a UI speed bump, not a comprehension event — Unvibe's entire data model then records a false positive.
- Being told "you didn't understand" is unpleasant; a poorly framed check could reduce retention even if accurate.

---

## What Unvibe Can Learn

1. **Design "Test me" as a generation task, not just recognition.** Multiple-choice questions are convenient but test the weak form. A short free-text "explain this function in your own words" or "what would break if X changed?" prompt, graded locally or via the existing AI path, is the mechanism the literature says works. (LLM grading of free-text explanations is feasible per Lekshmi-Narayanan et al.)
2. **Treat "I understand" as a low-trust signal.** It is a self-report subject to IOED. It can remain as a UX affordance (calm, non-blocking) but should never be recorded as verified comprehension on its own. If a "Test me" exists, the confirmation and the check result should be stored as distinct event types.
3. **Calibrate, don't just score.** Metacognitive bias vs. sensitivity is a useful frame: Unvibe can show users their own calibration ("you rated yourself 4/5 confident; you answered 2/3 correctly") as a first-class learning insight in the Companion — this teaches self-assessment, which is itself the Dunning-Kruger cure.
4. **Respect the confidence-vs-understanding decoupling.** The streamed, fluent, conversational explanation (Unvibe's core UX) may *increase* the illusion. Unvibe should not claim explanation delivery = learning; the recorded learning event should be the check outcome.
5. **Borrow the EduGuard evidence for framing.** Verification + overreliance control measurably beats plain tutoring. Unvibe can market "we don't just explain — we check" as an evidence-backed differentiator, distinct from every chat-based competitor.
6. **Use the quiet-review / attention research from 2026-08-04 together with this**: deliver the check at a low-attention-cost moment (bounded deferral) so the verification event isn't skipped out of interruption fatigue.

---

## What Unvibe Should Avoid Copying

1. **Conversational-fluency-as-proof.** The IUI 2025 result warns that making explanations *more conversational* can raise trust and overreliance without raising understanding. Unvibe should not treat richer chat as a substitute for a verification event.
2. **Gamified confidence meters.** Do not show a fake "comprehension score" or mastery percentage derived from arbitrary heuristics (AGENTS.md: never use arbitrary hardcoded mastery percentages). Calibration feedback must come from actual check results.
3. **Shaming error states.** A comprehension check that says "you're wrong" flatly risks the Dunning-Kruger/pleasantness trap. Keep the black-and-white calm design and frame misses as learning data, not failures.
4. **The term "illusion" in user-facing copy.** It is diagnostic vocabulary, not marketing language.
5. **Overclaiming prediction of understanding.** Never claim Unvibe "knows what the user understands" — it can only report demonstrated performance on its own checks, plus the user's self-report.

---

## Original Unvibe Interpretation

Competitors treat explanation as the product: more tokens, more context, more conversational fluency. The cognitive-science evidence says the *explanation* is only half the loop — the half that can even *inflate* false confidence. Unvibe's original contribution is to make the **verification** the transaction: a low-friction, level-appropriate comprehension moment whose outcome is the recorded learning event, and whose by-product is improved metacognitive calibration in the user.

In Unvibe terms: the industry optimized "change → detect → explain." Unvibe owns "verify → calibrate → retain." The 2026-08-01 change-communication report found competitors stop exactly where Unvibe begins; this report explains *why* that is a scientific gap, not just a product gap, and gives Unvibe the mechanism (self-explanation/generation prompts) to close it.

---

## Expected User Benefit

- A developer leaves a Unvibe session able to *reproduce the reasoning*, not just remember the words — the difference between "I feel fine about this diff" and "I can explain why this changed."
- Novices (the group most vulnerable to both IOED and Dunning–Kruger overconfidence) get an honest, private read on their actual grasp, which accelerates learning.
- Experts (who tend to underrate themselves) get calibration feedback that reduces unnecessary re-reading.
- The "Test me" outcome feeds Study/Concepts/review-queue retention data that is *measured*, not self-reported — making the whole learning dashboard more honest.
- The calm, verification-first framing is a defensible wedge against every chat-based competitor that ends at explanation.

---

## Technical Difficulty

| Component | Difficulty | Notes |
|---|---|---|
| Free-text "explain in your own words" prompt for "Test me" | Medium | Add a generation-mode question; grade via existing AI provider path (mock-first, labelled); keep secret-filter before send |
| Store check outcome + self-report as distinct event types | Low | Schema-additive change in the learning store; separates "understood (self)" from "demonstrated (check)" |
| Calibration insight surface (confidence vs. result) in Companion | Low-Medium | Pure presentation of existing data; needs an honest, non-gamified visual in the b/w design system |
| Downweight "I understand" click as a comprehension signal | Low | Change in event weighting; keep the affordance for UX, stop counting it as verification |
| Short-answer grading quality | Medium | LLM grading feasible (Lekshmi-Narayanan et al.); needs eval set + versioned prompt; label mock results |
| Randomized A/B of check formats | Medium | Needs an experiment flag + outcome logging; no new infra |

Unvibe does **not** need adaptive testing, IRT item banks, or longitudinal psychometrics for v1. The minimal viable version is: one generation-style prompt + honest event typing + a calibration readout.

---

## Security and Privacy Considerations

- Free-text user explanations are new content that would be sent for grading — must flow through the existing on-device secret filter *before* any remote request, consistent with the "backend never reads the repo" rule. A local-only mode (rule-based or no grading) must remain available.
- User explanations may themselves contain sensitive or proprietary reasoning; treat them as code-adjacent content under the same retention/consent rules as captured context.
- No new PII: comprehension outcomes are metadata of existing learning events.
- Do not store "you don't understand" verdicts in a way that could be used against the user (no punitive productization); frame as private learning data.

---

## Smallest Validation Experiment

A copy + event-typing experiment, no new backend:

1. In the widget, when the user taps "I understand," offer one optional generation-style prompt (e.g., "In one sentence, what does this change do?") before closing. Instrument whether users who answer are more likely to revisit the explanation than those who skip.
2. Add the calibration readout ("You were X% confident; you got Y/Z right") to a single Companion card. Measure whether "Test me" engagement or review-queue completion changes.
3. Compare (locally, with the mock AI labelled) a multiple-choice question vs. a short-answer prompt on the same code: does short-answer lower post-check confidence more (consistent with Rozenblit & Keil)?

Hypothesis: verification events (short-answer, calibrated feedback) increase demonstrable comprehension and downstream retention more than explanation-only flows, at negligible cost. If true, it validates the "we check, not just explain" wedge.

---

## v1, v2, or Later Recommendation

| Pattern | Recommendation | Rationale |
|---|---|---|
| "I understand" is a UX affordance, not a comprehension signal | **v1** | Data-model honesty fix; additive, cheap |
| Store check outcome + self-report as distinct event types | **v1** | Schema-additive; makes dashboard claims honest |
| One generation-style "Test me" prompt (short-answer) | **v1/v2** | v1 if graded via existing AI path with mock labelling; the core mechanism |
| Calibration readout (confidence vs. result) in Companion | **v2** | New surface; belongs in the Companion phase |
| Conversational follow-up as a *substitute* for verification | **never** | Evidence says it inflates trust, not understanding |
| Adaptive/IRT item banks, longitudinal psychometrics | **later** | Overkill for v1; revisit with user data |

---

## Key Takeaways

1. **"I understand" is scientifically unreliable.** IOED and Dunning–Kruger show self-reports of comprehension are systematically inflated, especially for explanatory knowledge and for novices — the exact population consuming AI-generated code.
2. **Explanations can make the problem worse.** Fluent conversational explanations raise perceived understanding and trust while raising overreliance (Chromik; He et al.). Delivering an explanation is not delivering learning.
3. **The correction is known and cheap:** ask the user to *generate/explain*, and self-assessment calibrates (Rozenblit & Keil). Unvibe's "Test me" should be built on generation prompts, not only recognition quizzes.
4. **Verification is measurable and effective.** EduGuard showed explicit verification + overreliance control cutting overreliance roughly in half. Unvibe can and should A/B test its own verification claims.
5. **Working code ≠ understood code.** Passing tests and a confident user are both poor comprehension proxies (Lehtinen et al.); Unvibe's check outcome is the only objective signal in the loop.
6. **The honest data model is the differentiator:** record demonstrated check outcomes separately from self-reports, and give users calibration feedback — turning Unvibe's verification loop into both a product wedge and a genuinely useful learning instrument.
