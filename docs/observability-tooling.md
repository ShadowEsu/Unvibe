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

## Mixpanel (marketing site)

- Browser: `NEXT_PUBLIC_MIXPANEL_TOKEN`; server fallback `MIXPANEL_TOKEN` / `MIXPANEL_HOST`.
- Client abstraction: `marketing/src/lib/analytics.ts` (named events only, after the visitor presses Allow).
- Env template: `marketing/.env.example`.
- The site used PostHog as well until 2 November 2026; it no longer loads or sends anything to PostHog.

## Backboard (docs MCP)

- Cursor MCP namespace: `user-backboard-docs` (`list_pages`, `get_page`, `search_docs`).
- Use for product/docs lookup when the server is connected; if tools fail, re-auth the MCP (`mcp_auth`) rather than inventing doc paths.
- Do not put Backboard API keys in the repo.
