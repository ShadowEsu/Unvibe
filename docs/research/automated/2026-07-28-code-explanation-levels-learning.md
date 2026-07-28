# Competitor Research: Explanation Levels and Comprehension Verification in Code AI Tools

**Date:** 2026-07-28
**Researcher:** Unvibe Night Lab (automated)
**Question:** How do competing code explanation tools handle adaptive explanation levels and comprehension verification?

## Sources

- Sourcegraph Cody documentation (sourcegraph.com/docs/cody, accessed 2026-07-28)
- Cursor documentation (docs.cursor.com, accessed 2026-07-28)
- GitHub Copilot Chat documentation (code.visualstudio.com/docs/copilot/copilot-chat, accessed 2026-07-28)
- Published product behavior as of July 2026

## Observed Product Behavior

### Sourcegraph Cody
- **Explanation levels**: None. Single chat interface with no level selection.
- **Comprehension verification**: None. No quiz, test, or follow-up verification.
- **Learning tracking**: None. No concept tracking, skill state, or progress.
- **Context**: Uses Sourcegraph's code search API to pull context from local and remote codebases.
- **Privacy**: Collects prompts and responses; does not train on user data.
- **Key differentiator**: Deep codebase context via Sourcegraph search index, available across IDEs.

### Cursor
- **Explanation levels**: None documented. Chat-based explain with no level selection.
- **Comprehension verification**: None.
- **Learning tracking**: None.
- **Privacy**: Not detailed in public docs (Wispr Flow is a design benchmark only).
- **Key differentiator**: Tight editor integration, AI-predictive editing, codebase indexing.

### GitHub Copilot Chat
- **Explanation levels**: None. Single chat interface. Custom instructions possible via `.github/copilot-instructions.md`.
- **Comprehension verification**: None.
- **Learning tracking**: None.
- **Privacy**: Microsoft/GitHub privacy policy; no training on private repos in enterprise.
- **Key differentiator**: Multi-agent system, MCP support, deep VS Code integration, agent window.

## User Problem Addressed

No competing tool addresses the problem of **retaining understanding of AI-generated code**. All tools focus on generating or explaining code in the moment — none verify that the developer actually understood the explanation, or track comprehension over time.

Unvibe's value proposition (comprehension verification, learning tracking, adaptive levels) is entirely uncontested in the current market.

## Why Each Competitor's Approach Works (and Why Not)

| Approach | Works because | Falls short because |
|---|---|---|
| Chat-only explanation | Low friction, familiar interface | No retention guarantee; developer can nod and move on |
| Custom instructions | Lets teams set tone | No adaptive levels per user; no comprehension check |
| Codebase-wide context | More accurate explanations | Still doesn't verify understanding |

## What Unvibe Can Learn

1. **Context depth matters**: Cody's cross-repo context search is a genuine differentiator. Unvibe's lightweight project summary (MVP scope) should evolve toward deeper context extraction without sacrificing privacy.
2. **Custom instructions are table stakes**: Copilot's `.github/copilot-instructions.md` pattern is simple and effective. Unvibe could offer per-project explanation preferences that don't require backend changes.
3. **No one does comprehension yet**: This is Unvibe's uncontested space. The "Test me" quiz after every explanation is novel.

## What Unvibe Should Avoid Copying

- Unvibe should not become a chat-based coding assistant. The market already has Copilot, Cody, Cursor Chat. Unvibe's differentiator is **post-generation comprehension**, not generation.
- Unvibe should not pursue code completion or agentic editing. These are crowded, resource-intensive, and diverge from the comprehension mission.

## Original Unvibe Interpretation

Unvibe's desktop overlay positioning is unique — it lives **outside** the editor, providing a quiet review surface that doesn't interrupt the coding flow. The floating widget pattern (inspired by Wispr Flow's layout quality) lets developers review explanations on their own schedule, with comprehension checks as a separate, intentional step.

The 5-level system (New/Beginner/Intermediate/Advanced/Expert) goes well beyond any competitor's single-level chat output.

## Expected User Benefit

Developers using Unvibe should retain more from AI explanations than users of any chat-based tool, because:
1. They choose the level that matches their current knowledge
2. They verify comprehension via a quiz
3. Their learning history is tracked and surfaced in the dashboard

## Technical Difficulty

- **Low difficulty**: Explanation levels are prompt engineering, not model training
- **Medium difficulty**: Comprehension question generation requires structured JSON output parsing and validation
- **Low difficulty**: Concept extraction from AI output rather than from source code
- **Medium difficulty**: Learning tracking across sessions requires a sync layer

## Security and Privacy Considerations

- Explanation levels require no additional data beyond code context
- Comprehension quizzes are stateless on the backend; learning events are stored with the same privacy guarantees as other events
- Concept tracking stores only kebab-case concept slugs and integer correct/incorrect counts — no code or PII

## Smallest Validation Experiment

Ship the "Explain differently" + "Test me" loop for a single code selection without learning tracking. Measure: do users who take the quiz self-report higher retention? If yes, add learning tracking.

## Recommendation

- v1: Core loop (explain → "Test me" → result) without learning tracking
- v1.5: Learning tracking (concept, skill state, profile) — already partially built
- v2: Adaptive level selection based on quiz performance — not yet started

This is an **uncontested market position** that should be protected and emphasized in all product messaging.
