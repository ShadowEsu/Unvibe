# Founder Decisions Required — 2026-07-24

**Mission:** competitor-research-and-v2

## Decisions Needed

### 1. Review the research report and decide which recommendations to adopt
The report at `docs/research/automated/2026-07-24-desktop-ai-overlay-patterns.md` identifies 8 interaction patterns and 5 anti-patterns from Wispr Flow, Pieces, Superwhisper, Cody, Copilot, and kapa.ai.

Key decisions needed:
- Should the floating bar use the Wispr Flow "auto-dim when idle" pattern?
- Should explanations stream token-by-token (recommended) or appear all-at-once?
- Should Unvibe implement citation with uncertainty signaling (kapa.ai pattern)?
- What's the right global hotkey default?

### 2. CI token permissions
The `opencode/nightly-competitor-research-v2-desktop-overlay-patterns` branch was pushed but a PR could not be auto-created because the GitHub Actions token lacks PR creation permissions. To create the PR manually:
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-competitor-research-v2-desktop-overlay-patterns

Or, provide a fine-grained PAT with `pull requests: write` scope for future night-lab runs.

### 3. Market opportunity validation
The research identifies a clear whitespace opportunity: no existing product combines minimal desktop overlay access with deep, level-adaptive code comprehension. This strengthens the v2 thesis.

## No Critical Issues
- No security or privacy concerns in this research
- No code was modified
- No dependencies were changed
