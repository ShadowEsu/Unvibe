# Permissions

## Default (Global)

| Tool | Default | Notes |
|------|---------|-------|
| read | ✅ allowed | All agents |
| grep | ✅ allowed | All agents |
| glob | ✅ allowed | All agents |
| webfetch | ✅ allowed | All agents |
| skill | ✅ allowed | Load skills |
| todowrite | ✅ allowed | Track progress |
| bash | ✅ restricted | Typecheck, test, build, git status/diff/log only |
| edit | ❌ denied | Must be explicitly allowed per agent |
| write | ❌ denied | Must be explicitly allowed per agent |
| apply_patch | ❌ denied | Not used — use edit/write instead |

## Agent Permissions

### Architect
- **bash**: `npm run typecheck`, `npm test`, `npm run build`, `git *`, `cat *`, `ls *`
- **edit/write/apply_patch**: DENIED

### Implementer
- **bash**: `npm run typecheck`, `npm test`, `npm run build`, `git add *`, `git commit *`, `git diff *`
- **edit/write/apply_patch**: ALLOWED (any file in scope)

### Test Engineer
- **bash**: `npm run typecheck`, `npm test`, `npm run build`, `node --test *`
- **edit/write**: ALLOWED only in `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `test/**`, `__tests__/**`

### Security Reviewer
- **bash**: `npm run typecheck`, `npm test`, `git diff *`, `cat *`, `ls *`
- **edit/write/apply_patch**: DENIED (read-only)

### Product Designer
- **bash**: `npm run typecheck`, `npm run build`, `cat *`, `ls *`
- **edit/write**: ALLOWED only in `*.css`, `*.tsx`, `*.html`

### Researcher
- **bash**: `cat *`, `ls *`, `git log *`
- **edit/write**: ALLOWED only in `docs/research/**`, `docs/agent-system/**`

### Integration Reviewer
- **bash**: `npm run typecheck`, `npm test`, `npm run build`, `git *`, `cat *`, `ls *`
- **edit/write**: ALLOWED only in `docs/**`

## MCP Permissions

### Context7
- **Mode**: Remote MCP
- **Tools**: `resolve-library-id`, `query-docs`
- **Auth**: Bearer token from `CONTEXT7_API_KEY` environment variable
- **Restrictions**: Read-only documentation queries only

### GitHub MCP
- **Mode**: Remote MCP (OAuth)
- **Enabled toolsets**: `context`, `repos`, `issues`, `pull_requests`, `users`
- **Disabled**: `actions`, `code_security`, `dependabot`, `secret_protection`, `security_advisories`, `discussions`, `gists`, `git`, `labels`, `notifications`, `orgs`, `projects`, `stargazers`, `copilot`, `github_support_docs_search`
- **Read-only mode**: NOT enabled (PR creation and issue updates allowed)
- **Reasoning**: The implementer and integration-reviewer need PR/issue write access. Other agents are read-only via their tool restrictions.
