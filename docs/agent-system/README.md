# Unvibe Agent System

## Overview

This directory documents the OpenCode-based agent engineering system for the Unvibe repository.

The system provides:
- **Skills**: Reusable instruction packages for specific development tasks.
- **Agents**: Specialised personas with role-specific tools and skills.
- **MCP servers**: Context7 for current documentation, GitHub MCP for repository operations.
- **Model routing**: Per-agent model configuration for cost optimisation.
- **Permissions**: Least-privilege tool access per agent role.

## Quick Start

To use the agent system, ensure OpenCode is installed and configured. The root `opencode.json` configures all agents, skills, MCP servers, and permissions.

### Invoking Agents

OpenCode subcommand:
```
opencode --agent architect "Write a plan for adding export functionality"
opencode --agent implementer "Implement the export feature per the architect's plan"
opencode --agent security-reviewer "Review the authentication flow for vulnerabilities"
```

### Skills

Skills are automatically discovered from these directories:
- `.opencode/skills/` — Unvibe-specific skills
- `.agents/skills/` — Upstream skills (superpowers, agent-skills) + existing night-lab skill

Available skills (see `skill-selection.md` for full rationale):

| Skill | Source | Purpose |
|-------|--------|---------|
| brainstorming | superpowers | Requirements discovery, product brainstorming |
| writing-plans | superpowers | Implementation planning |
| test-driven-development | superpowers | RED-GREEN-REFACTOR cycle |
| systematic-debugging | superpowers | 4-phase root cause analysis |
| verification-before-completion | superpowers | Evidence-based completion checks |
| finishing-a-development-branch | superpowers | PR preparation and handoff |
| requesting-code-review | superpowers | Code review request process |
| subagent-driven-development | superpowers | Subagent-based implementation |
| spec-driven-development | agent-skills | PRD-driven architecture |
| frontend-ui-engineering | agent-skills | Component architecture, responsive, WCAG |
| code-review-and-quality | agent-skills | Five-axis code review |
| security-and-hardening | agent-skills | OWASP, auth, secrets management |
| performance-optimization | agent-skills | Measure-first performance work |
| unvibe-engineering | Custom | Electron IPC, backend, privacy |
| unvibe-product-design | Custom | Product design critique |
| unvibe-nightly-improvement | Custom | Nightly automation |
| integration-review | Custom | Cross-branch review, morning summary |

## Directory Structure

```
docs/agent-system/
├── README.md                  # This file
├── current-audit.md           # Pre-installation audit
├── skill-selection.md          # Full selection rationale
├── agents.md                  # Agent personae reference
├── model-routing.md           # Model configuration guide
├── permissions.md             # Tool permission reference
├── updating-skills.md         # How to update safely
└── troubleshooting.md         # Common issues
```

## Nightly Operations

The GitHub workflow `.github/workflows/unvibe-autonomous-night-lab.yml` runs 7 missions overnight:
1. Repository health
2. Backend and sync
3. Desktop overlay
4. AI and learning engine
5. Competitor research
6. Product design and accessibility
7. Integration review and morning summary

Each mission loads only relevant skills.

## Files Created/Modified

See `git log` on the `automation/opencode-skill-system` branch for the full change set.
