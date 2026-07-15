# Troubleshooting

## Skill Discovery

### Skill not found when using `skill` tool

**Check**: Is the skill directory in a configured path?
```bash
ls .opencode/skills/         # Unvibe-specific skills
ls .agents/skills/            # Upstream + night-lab skills
```

**Fix**: Add the path to `opencode.json`:
```json
{
  "skills": [".opencode/skills", ".agents/skills"]
}
```

### Skill frontmatter invalid

**Check**: Does the SKILL.md have valid YAML frontmatter?
```yaml
---
name: skill-name
description: What it does
---
```

**Fix**: Ensure frontmatter is the first 3+ lines of the file (starting and ending with `---`). Required fields: `name`, `description`.

## Agent Configuration

### Agent not loading

**Check**: Is the agent defined in `opencode.json`?
```json
{
  "agent": {
    "architect": { "prompt": "...", "skills": [...], "tools": {...} }
  }
}
```

**Fix**: Ensure the agent name matches between `--agent <name>` and the config key. Ensure the prompt file exists at the given path.

### Agent loading wrong skills

**Check**: The `skills` array in the agent config lists the skill names as they appear in the SKILL.md `name:` frontmatter field.

**Fix**: Match the skill name exactly (case-sensitive, hyphenated).

### Agent can't write files

**Check**: The agent's `tools` config has write permissions. If edit/write are not listed, they default to the global permission (false).

**Fix**: Add explicit `"edit": true` or `"write": true` to the agent's tools config.

## MCP Servers

### Context7 not responding

**Check**: Is `CONTEXT7_API_KEY` set in your environment?

**Fix**: 
```bash
# On macOS/Linux
export CONTEXT7_API_KEY=your_key_here
# On Windows (PowerShell)
$env:CONTEXT7_API_KEY = "your_key_here"
```

Then restart OpenCode.

### GitHub MCP not connecting

**Check**: Is OAuth configured? The remote URL uses OAuth by default.

**Fix**: 
```bash
opencode mcp auth github
```

If OAuth fails, use a PAT:
```json
{
  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://api.githubcopilot.com/mcp/",
      "enabled": true,
      "oauth": false,
      "headers": {
        "Authorization": "Bearer ghp_your_token_here"
      }
    }
  }
}
```

## Model Routing

### Agent using wrong model

**Check**: The model router config in `opencode.json`.

**Fix**: Set the model explicitly per agent:
```json
{
  "model": {
    "router": {
      "test-engineer": "deepseek/deepseek-chat"
    }
  }
}
```

### Model too slow or too expensive

**Check**: The model assigned to that agent in `opencode.json`.

**Fix**: Switch to a cheaper model:
```json
{
  "model": {
    "router": {
      "architect": "deepseek/deepseek-chat"
    }
  }
}
```

## Conflicting Instructions

### Skills from different sources give contradictory instructions

**Resolution**: 
1. Identify which skills are loaded (check the agent config).
2. Remove duplicate or overlapping skills.
3. If conflict is in shared skills, use `AGENTS.md` rules as the tiebreaker — Unvibe-specific rules in AGENTS.md take precedence over generic skill instructions.

## Reducing Token Usage

### Too many skills loaded

**Problem**: Every skill adds context. Loading 17 skills when only 2 are needed wastes tokens.

**Fix**: 
- Agents should load only relevant skills (configured in `opencode.json`).
- If using skill tool manually, avoid loading meta skills unless needed.

### Large skill files

**Problem**: Some skills (subagent-driven-development, brainstorming) are 10-20KB each.

**Fix**: Skills are loaded lazily — they only consume tokens when the skill tool loads them. Avoid loading large skills unless the current task needs them.

## Disabling the System

### Disable specific agent
Remove or comment out the agent from `opencode.json`.

### Disable all skills
Set `"skills": []` in `opencode.json`.

### Disable MCP
Set `"enabled": false` per MCP server in `opencode.json`.

### Roll back to previous config
```bash
git checkout main -- opencode.json
git checkout main -- AGENTS.md
git checkout main -- .opencode/
git checkout main -- .agents/skills/  # Be careful — this removes all skills
```
