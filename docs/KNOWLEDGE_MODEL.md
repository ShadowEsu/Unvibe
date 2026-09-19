# Knowledge model

Desktop store: `~/Library/Application Support/Unvibe/unvibe-knowledge.json` (mode 0600).

A knowledge object has type, title, summary, body, source refs, visibility (PRIVATE/TEAM), verification (AI_GENERATED / HUMAN_CONFIRMED / HUMAN_CORRECTED), code hash, and freshness.

TEAM visibility is stored locally only. There is no org sync yet.

Human-verified bodies are not replaced by later AI-generated upserts.

Freshness is change-driven: compare the saved hash to current file text, then weight token change by path importance (auth/billing/schema higher than docs/tests).

Optional cloud tables `knowledge_objects` and `understanding_checks` are additive. The desktop does not upload explanation bodies yet.
