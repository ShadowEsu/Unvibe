# Observability tooling (agents)

Short map for Cursor / ChatGPT / MCP agents. No secrets in this file.

## Datadog (host Agent, macOS)

- Package config lives at `/opt/datadog-agent/etc/datadog.yaml` (not `~/.datadog-agent/`).
- Log collection: `logs_enabled: true`.
- Python file source: `/opt/datadog-agent/etc/conf.d/python.d/conf.yaml`
  - path `/var/log/myapplication/python.log`
  - `service: myapplication`, `source: python`, `sourcecategory: sourcecode`
- Re-run or mirror setup: `scripts/setup-datadog-python-logs.sh` (needs sudo / admin).
- Verify: `sudo datadog-agent status` → Logs Agent → `python` integration Status OK and LogsSent > 0.

## PostHog (marketing site)

- Browser: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (default `https://us.i.posthog.com`).
- Server capture: `POSTHOG_PROJECT_API_KEY` / `POSTHOG_HOST` via `marketing/src/lib/posthogServer.ts`.
- Client abstraction: `marketing/src/lib/analytics.ts` (named events only; Mixpanel is also wired).
- Env template: `marketing/.env.example`.
- MCP: PostHog tools in Cursor (`user-posthog`). Project is Unvibe / Default project on `us.posthog.com`.

## Backboard (docs MCP)

- Cursor MCP namespace: `user-backboard-docs` (`list_pages`, `get_page`, `search_docs`).
- Use for product/docs lookup when the server is connected; if tools fail, re-auth the MCP (`mcp_auth`) rather than inventing doc paths.
- Do not put Backboard API keys in the repo.
