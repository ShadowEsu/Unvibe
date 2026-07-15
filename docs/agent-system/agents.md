# Agents Reference

## Overview

Seven specialised agents are defined in `opencode.json`. Each agent has:
- A system prompt (`.opencode/agents/<name>.md`)
- A set of skills it can load
- A restricted tool set (least-privilege)
- A specific model assignment (see `model-routing.md`)

## Agent Table

| Agent | Skills | Tools | Model | Primary Action |
|-------|--------|-------|-------|----------------|
| architect | brainstorming, spec-driven-development, writing-plans, current-documentation-research | read, grep, glob, webfetch, skill, todowrite, restricted bash | deepseek/deepseek-v4-flash | Write plans, define scope |
| implementer | implementation-planning, tdd, frontend-ui-engineering, unvibe-engineering, backend-and-sync, verification-before-completion | read, write, edit, apply_patch, bash (build/test/git) | deepseek/deepseek-v4-flash | Implement one task |
| test-engineer | tdd, systematic-debugging, performance-optimization, accessibility-review | read, write/edit in test files, bash (test/build) | deepseek/deepseek-chat | Add tests, fix bugs |
| security-reviewer | security-and-hardening, unvibe-engineering, code-review-and-quality | read-only + restricted bash | deepseek/deepseek-v4-flash | Security audit |
| product-designer | unvibe-product-design, frontend-ui-engineering | read, write/edit in CSS/TSX/HTML, bash (build) | deepseek/deepseek-v4-flash | Design critique |
| researcher | current-documentation-research (Context7), brainstorming | read-only + write docs/research/ | deepseek/deepseek-chat | Research |
| integration-reviewer | integration-review, code-review-and-quality, verification-before-completion | read-only + write docs/ | deepseek/deepseek-v4-flash | Cross-branch review |

## Tool Permission Reference

See `permissions.md` for full details on what each agent can and cannot do.
