# Architecture (MVP)

## Components
- **Extension** (VS Code + Cursor, TypeScript): change detection (git diff + selection),
  local context construction, **local secret filtering**, quiet prompt (status bar +
  notification), webview review panel. Owns all network I/O.
- **Backend** (Next.js App Router + Supabase): auth, streaming review endpoint (SSE),
  persistence, dashboard API. **Never reads the repo** — only receives filtered context.
- **AI layer**: Vercel AI SDK provider abstraction → Anthropic Claude. Versioned prompt
  templates, structured JSON output, mandatory file/line citations, token/cost caps.
- **Dashboard** (Next.js web, black-and-white): history, saved explanations, projects, profile.

## Load-bearing rule
Context is built and secret-filtered **in the extension**; the backend never touches source.
This makes the "preview what will be transmitted" honest and keeps repos local until consent.

## Data flow (git-diff review)
1. Edit → extension detects working-tree change (`vscode.git` API).
2. Status bar updates; one quiet "Review change?" prompt (deduped, non-modal).
3. User opens panel → extension computes `git diff -U` + enclosing scope + imports + shallow structure.
4. **Local secret filter**; on hit, block and show location.
5. First analysis per repo → show "what will be transmitted" preview + consent.
6. Extension POSTs filtered context + level (bearer token) to streaming endpoint.
7. Backend builds prompt → provider → **streams SSE** into the webview.
8. User picks I understand / Explain differently / Test me → outcome + comprehension POST.
9. API writes review event + explanation + mastery delta (RLS-scoped) to Postgres.
10. Dashboard reads from the same DB.

## Database schema (proposal)
```
users            (id, email, created_at, settings jsonb, learner_level)
projects         (id, user_id, repo_hash, name, primary_language, created_at)
repositories     (id, project_id, remote_hash, consent_granted_at, ignore_config jsonb)
review_events    (id, user_id, project_id, scope, level, outcome, file_paths[], line_ranges jsonb, created_at)
explanations     (id, review_event_id, type, payload jsonb, citations jsonb, saved bool, created_at)
comprehension    (id, review_event_id, question, expected jsonb, result, created_at)
concepts         (id, slug, label)
concept_mastery  (id, user_id, concept_id, state, updated_at)
consent_log      (id, user_id, repository_id, action, created_at)
```
RLS: every table scoped by `user_id`. Additive-only migrations during MVP.

## API contract (proposal, /api/v1)
| Method · Path | Purpose |
|---|---|
| POST /auth/device | extension token exchange |
| POST /reviews (SSE) | create review, stream explanation |
| POST /reviews/:id/followup (SSE) | follow-up question |
| POST /reviews/:id/comprehension | fetch/record "test me" |
| POST /reviews/:id/outcome | understood / needs_review |
| POST /explanations/:id/save | save explanation |
| GET /history · /projects · /profile | dashboard reads |
| DELETE /account · /repositories/:id | deletion / disconnect |

## Extension ↔ backend
HTTPS + bearer token (device/PAT flow). SSE for streaming. Webview ↔ host via `postMessage`
only — the webview never touches the network.

## Failure states
offline (queue + retry) · provider down / rate-limited (graceful, no partial mastery write) ·
secret detected (hard block) · context too large (truncate + notice) · auth expired (re-auth,
keep pending review) · no git (fall back to selection/file) · webview crash (recover from store).

## Operating-cost drivers (ranked)
1. LLM tokens (dominant) — capped context, truncation, level-appropriate model, caching.
2. Hosting (Vercel + Supabase). 3. Egress/stream duration. 4. Storage (metadata + JSONB only).
