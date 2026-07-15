# Current System Audit

Date: 2026-07-14
Auditor: OpenCode

## Directory Structure

| Path | Exists | Purpose |
|------|--------|---------|
| `opencode.json` | ❌ Missing | Root OpenCode configuration |
| `.opencode/` | ❌ Missing | OpenCode skills/agents directory |
| `.opencode/skills/` | ❌ Missing | OpenCode skill files |
| `.opencode/agents/` | ❌ Missing | OpenCode agent definitions |
| `.agents/skills/unvibe-night-lab/SKILL.md` | ✅ Present | Night lab automation skill |
| `AGENTS.md` | ✅ 132 lines | Durable project rules for agents |
| `CLAUDE.md` | ✅ 132 lines | Near-duplicate of AGENTS.md |
| `.claude/launch.json` | ✅ Present | Claude launch config for web/ |

## Existing Instructions

### AGENTS.md (132 lines)
- Product purpose and scope
- Architecture summary
- Directory structure
- Coding conventions
- Design rules (strict B&W)
- Privacy rules
- Testing requirements
- Build commands (app/, extension/, web/, server/)
- Definition of done
- Documentation rules
- Change-control rule

### CLAUDE.md (132 lines)
- Nearly identical to AGENTS.md
- Minor wording differences ("Codex skills" vs "OpenCode skills")
- `Anthropic Claude` vs `Anthropic Codex` in architecture summary

### .agents/skills/unvibe-night-lab/SKILL.md (203 lines)
- Well-structured with frontmatter
- 7 mission definitions
- Permissions, forbidden actions, cost controls
- Verification and PR standards
- Design principles, privacy standards, competitor research rules
- Morning handoff protocol

## Issues Found

### 1. Duplicated Instructions
- `AGENTS.md` and `CLAUDE.md` are 95% identical (132 lines each). This is wasteful — dual maintenance, risk of divergence, unnecessary token consumption.
- `CLAUDE.md` references are redundant when OpenCode reads `AGENTS.md`.

### 2. No OpenCode Configuration
- No `opencode.json` exists. OpenCode features (MCP, agents, skill paths, model routing, permissions) cannot be configured.
- `.opencode/` directory does not exist.

### 3. No Skill Path Registered
- `.agents/skills/` contains the night-lab skill but OpenCode has no `skills` path configured.
- Skills won't be discovered unless explicitly loaded via `skill` tool.

### 4. No Agent Routing
- No specialized agents defined. Every task runs as the default agent with full tool access.
- No architect/implementer/reviewer separation possible.

### 5. No MCP Servers
- No Context7 for current documentation.
- No GitHub MCP server for repository operations.
- Both would improve accuracy and capability.

### 6. No Model Routing
- No per-agent model configuration. All work uses the default model.
- Cannot route cheap tasks to faster models or hard tasks to stronger models.

### 7. No Permission Scoping
- All tools available globally by default. No least-privilege boundaries.
- No separation between read-only and write-capable agents.

### 8. Stale Architecture References
- Architecture doc (`docs/architecture.md`) describes the extension-first architecture, not the desktop-pivot architecture.
- References to `vscode.git` API and webview panel that no longer exist in the primary surface.

### 9. Near-Duplicate SKILL.md
- `docs/automation/nightly/setup-audit.md` overlaps with `unvibe-night-lab/SKILL.md` content.

### 10. Missing Test Commands
- `web/` has no `npm test` script (only `npm run build` and `npm run typecheck`).

## Verification Summary

| Check | Result |
|-------|--------|
| Build (app/) | Passes |
| Typecheck (app/) | Passes |
| Build (web/) | Passes |
| Typecheck (web/) | Passes |
| Tests (app/) | Passes (9/9) |
| Tests (web/) | No test script |
| Tests (extension/) | Not verified |
| Tests (marketing/) | Not verified |
| GitHub Actions | Night lab workflow exists and configured |

## Proposed Changes

| Change | Priority | Risk | Approval |
|--------|----------|------|----------|
| Create `opencode.json` | High | Low | Auto |
| Create `.opencode/skills/` | High | Low | Auto |
| Create `.opencode/agents/` | High | Low | Auto |
| Install upstream skill packages | High | Low | Auto |
| Create Unvibe-specific skills | High | Low | Auto |
| Condense AGENTS.md (remove duplicate from CLAUDE.md) | Medium | Low | Required |
| Remove CLAUDE.md (redundant with AGENTS.md) | Low | Low | Recommended |
| Configure Context7 MCP | Medium | Low | Requires API key |
| Configure GitHub MCP | Medium | Low | Requires OAuth |
| Add test script to web/ package.json | Low | Low | Optional |

## Conflicts to Resolve
- None identified — no existing skills, agents, or MCP configs to conflict with.

## Risks
- Installing too many skills increases token usage and context overhead.
- Upstream skills may contain instructions that conflict with Unvibe-specific rules.
- MCP servers require environment variables that must be documented for each developer.
- Overly permissive agent definitions could allow unintended file modifications.
