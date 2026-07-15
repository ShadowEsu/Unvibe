# Skill Selection Analysis

Date: 2026-07-14

## Selection Principles

- Prefer proven upstream skills when they clearly fit the category.
- Create original Unvibe skills when behavior depends on Unvibe-specific architecture, privacy rules, or design system.
- Never install competing skills for the same responsibility unless boundaries are explicit.
- Record source, license, decision, and rationale for every skill.

## Decision Table

| # | Category | Source | Skill Name | Decision | Rationale |
|---|----------|--------|------------|----------|-----------|
| 1 | requirements-discovery | obra/superpowers | `brainstorming` | **Install** | Socratic Q&A to refine vague requests into spec documents. No Unvibe-specific dependency. MIT. |
| 2 | product-brainstorming | obra/superpowers | `brainstorming` | Same as #1 | Covers both requirements discovery and product brainstorming in one skill. |
| 3 | architecture-analysis | addyosmani/agent-skills | `spec-driven-development` | **Install** | PRD-driven approach with architecture considerations. Complements brainstorming. MIT. |
| 4 | implementation-planning | obra/superpowers | `writing-plans` | **Install** | Decomposes specs into bite-sized tasks with file paths, verification steps. MIT. |
| 5 | test-driven-development | obra/superpowers | `test-driven-development` | **Install** | Strict RED-GREEN-REFACTOR cycle. MIT. |
| 6 | systematic-debugging | obra/superpowers | `systematic-debugging` | **Install** | 4-phase root cause process. MIT. |
| 7 | frontend-implementation | addyosmani/agent-skills | `frontend-ui-engineering` | **Install** | Component architecture, design systems, responsive, WCAG. MIT. |
| 8 | desktop-electron-development | Custom Unvibe | `unvibe-engineering` | **Create** | Unvibe-specific Electron architecture, IPC boundaries, macOS behavior. |
| 9 | backend-and-sync | Custom Unvibe | `unvibe-engineering` | Same as #8 | Supabase, sync, auth, AI provider privacy — all Unvibe-specific. |
| 10 | security-and-privacy-review | addyosmani/agent-skills | `security-and-hardening` | **Install** | OWASP Top 10, auth patterns, secrets, dependency auditing. MIT. |
| 11 | accessibility-review | addyosmani/agent-skills | reference checklist | **Reference** | Use `references/accessibility-checklist.md` as a standard. Not a full skill — too narrow. |
| 12 | performance-investigation | addyosmani/agent-skills | `performance-optimization` | **Install** | Measure-first, Core Web Vitals, profiling workflows. MIT. |
| 13 | current-documentation-research | upstash/context7 | Context7 MCP | **Configure** | MCP server for retrieving current library documentation. Requires API key. |
| 14 | competitor-research | obra/superpowers | `brainstorming` | Same as #1 | The brainstorming skill's structured Q&A works for competitor analysis with appropriate framing. |
| 15 | product-design-critique | Custom Unvibe | `unvibe-product-design` | **Create** | Unvibe-specific design system, visual direction, and review criteria. |
| 16 | code-review | addyosmani/agent-skills | `code-review-and-quality` | **Install** | Five-axis review, severity labels, change sizing. MIT. |
| 17 | verification-before-completion | obra/superpowers | `verification-before-completion` | **Install** | Ensures fixes are actually correct before claiming completion. MIT. |
| 18 | pull-request-handoff | obra/superpowers | `finishing-a-development-branch` | **Install** | Branch completion workflow: test verification, merge/PR decision. MIT. |
| 19 | nightly-repository-health | Custom Unvibe | `unvibe-nightly-improvement` | **Enhance** | Existing `unvibe-night-lab/SKILL.md` already covers this. Improve rather than replace. |
| 20 | integration-review | Custom Unvibe | `integration-review` | **Create** | Cross-PR inspection, merge-ordering, morning-summary — Unvibe-specific handoff protocol. |

## Rejected Skills

| Skill | Source | Reason for Rejection |
|-------|--------|----------------------|
| `dispatching-parallel-agents` | superpowers | Overkill for current scope — single-agent tasks are sufficient. Can be added later. |
| `using-git-worktrees` | superpowers | Worktrees add overhead. Current branch-per-task workflow is adequate. |
| `receiving-code-review` | superpowers | Code review is handled by the reviewer agent, not the implementer. |
| `writing-skills` | superpowers | Skills are written by humans or during this setup. Not needed at runtime. |
| `interview-me` | agent-skills | Overlaps with brainstorming spec refinement. |
| `idea-refine` | agent-skills | Overlaps with brainstorming. |
| `incremental-implementation` | agent-skills | superpowers `subagent-driven-development` covers this. |
| `context-engineering` | agent-skills | OpenCode handles context natively. |
| `source-driven-development` | agent-skills | Replaced by Context7 for current documentation. |
| `doubt-driven-development` | agent-skills | Valuable but adds process overhead. Consider for security-critical work only. |
| `api-and-interface-design` | agent-skills | Not needed — Unvibe backend is already designed. |
| `browser-testing-with-devtools` | agent-skills | Electron app testing is different. Not applicable. |
| `code-simplification` | agent-skills | Covered by `code-review-and-quality`. |
| `git-workflow-and-versioning` | agent-skills | Covered by `finishing-a-development-branch`. |
| `ci-cd-and-automation` | agent-skills | CI/CD is already configured via GitHub Actions. |
| `deprecation-and-migration` | agent-skills | Not needed for current MVP. |
| `documentation-and-adrs` | agent-skills | Documentation decisions are made by the architect. |
| `observability-and-instrumentation` | agent-skills | Not needed for MVP scope. |
| `shipping-and-launch` | agent-skills | Deployment is manual. |
| `planning-and-task-breakdown` | agent-skills | Overlaps with superpowers `writing-plans`. |
| `debugging-and-error-recovery` | agent-skills | Overlaps with superpowers `systematic-debugging`. |
| all Vercel-labs skills | vercel-labs/skills | Covered by addyosmani/agent-skills or superpowers. |
| `find-skills` | vercel-labs/skills | Skill discovery is handled by OpenCode natively. |

## Installation Method

Selected upstream skills will be installed via the `npx skills` CLI when available, or manually copied/adapted when the CLI is not required.

Skills marked **Install** will be installed as-is from the upstream source.
Skills marked **Create** will be authored as original Unvibe skills.
Skills marked **Reference** will be linked as supporting documentation.

## Overlap Map

```
brainstorming (superpowers) — requirements, brainstorming
writing-plans (superpowers) — planning
subagent-driven-development (superpowers)* — implementation execution
test-driven-development (superpowers) — testing
systematic-debugging (superpowers) — debugging
verification-before-completion (superpowers) — verification
finishing-a-development-branch (superpowers) — PR handoff
requesting-code-review (superpowers) — review request
spec-driven-development (agent-skills) — architecture
frontend-ui-engineering (agent-skills) — frontend
code-review-and-quality (agent-skills) — code review
security-and-hardening (agent-skills) — security
performance-optimization (agent-skills) — performance
unvibe-engineering (custom) — Electron, backend, sync, privacy
unvibe-product-design (custom) — product design
unvibe-nightly-improvement (custom) — nightly automation
integration-review (custom) — integration review
```

*`subagent-driven-development` is included for the implementer workflow but not as a standalone triggered skill — it serves as the execution engine within the implementer agent.
