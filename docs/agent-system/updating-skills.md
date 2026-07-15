# Updating Skills

## Upstream Skills

Superpowers and agent-skills skills are installed in `.agents/skills/` as copies (not symlinks).

### Check for Updates

```bash
# Check if upstream has newer versions
cd /tmp
git clone https://github.com/obra/superpowers.git --depth 1
# Compare skills/ directory with ~/WebstormProjects/Unvibe/.agents/skills/
```

### Update Process

1. Create a branch: `git checkout -b chore/update-superpowers`
2. Reinstall the skills: `npx skills add obra/superpowers -s <skill-names> -a opencode -g -y`
3. Copy updated skills from `~/.agents/skills/` to `.agents/skills/`
4. Review the diff: `git diff main...chore/update-superpowers -- .agents/skills/`
5. Check for new instructions, changed permissions, or removed content.
6. Run validation: typecheck, test, build in each package.
7. Update `docs/agent-system/current-audit.md` with the new revision.
8. Open a PR.

### How Often

- Check every 2 weeks.
- Emergency updates: only if a skill contains broken instructions.
- Do NOT auto-merge skill updates.

## Unvibe-Specific Skills

Unvibe-specific skills are in `.opencode/skills/`.

### Editing

Edit the `SKILL.md` file directly on a branch.

### Change Process

1. Create a branch.
2. Edit the skill.
3. Verify the skill frontmatter is valid (name + description required).
4. Verify OpenCode discovers the skill (`opencode --skill <name>`).
5. Add a changelog entry to `docs/agent-system/updating-skills.md`.
6. Open a PR.

### Removal

To remove a skill:
1. Delete the skill directory.
2. Remove it from any agent definitions in `opencode.json`.
3. Update `docs/agent-system/skill-selection.md` with the removal reason.
4. Open a PR.

## MCP Server Updates

MCP servers are configured in `opencode.json`. Update URLs or credentials as needed.

- **Context7**: The remote URL `https://mcp.context7.com/mcp` is stable. Update only if the service changes.
- **GitHub MCP**: The remote URL `https://api.githubcopilot.com/mcp/` is stable. Update only if the service changes.

## When Not to Update

- Do not update skills during active feature work.
- Do not merge skill updates without a review.
- Do not update if tests fail after the update — investigate first.
- Do not update a skill that is working correctly just to match upstream.
