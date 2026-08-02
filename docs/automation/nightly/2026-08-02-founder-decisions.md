# Founder Decisions Required — 2026-08-02

**Mission:** competitor-research-and-v2

## Decisions Needed

### 1. PR creation / manual review
The research branch `opencode/nightly-competitor-research-and-v2-privacy-trust-positioning` was
pushed and a PR was attempted. Known limitation from prior nights (2026-07-24, 2026-07-31,
2026-08-01): the GitHub Actions token reports `pull-requests: read` in practice even though the
workflow grants `pull-requests: write`, so PR creation may fail. If no PR link appears, create it
manually:
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-competitor-research-and-v2-privacy-trust-positioning

### 2. Adopt the v1 "trust as an experience" copy items?
The report recommends three cheap, low-risk v1 changes:
- **One-line trust statements in-product** ("No training. No code stored. Filtered locally.") —
  matches the proven leader register (Cursor's "we do not use Inputs or Suggestions to train";
  GitHub's "No, Business/Enterprise data is not used for training").
- **Publish retention/metadata-only numbers** in a Settings → Privacy surface (what was filtered,
  what was transmitted, what is stored as metadata only). Stronger than Copilot's published numbers
  (28-day prompt retention, 2-year engagement data) and requires no new data flow.
- **Market the existing on-device secret filter as built-in secret protection** — GitHub sells the
  equivalent as Advanced Security at $19/active committer/month; Unvibe's filter runs before every
  remote request for free.

These are copy/presentation changes on existing code paths. Approval would make them v1 scope items.

### 3. Extend preview-before-send to every request (v1 or v2)?
Currently `docs/privacy.md` says the consent screen appears only when the secret scan finds a suspect
value. The report recommends **full preview-before-send for all contexts** as the single most
defensible differentiator — no observed leader shows the user the exact payload at the moment it
would leave the machine. This is a medium-effort change in the send path (`app/src/main/`) plus a
consent-flow UX in the black-and-white design system. Decision needed: v1 (strong wedge) or v2
(protect focus).

### 4. Hold the "we never train on your code" marketing claim until provider verification
The report recommends against publishing an absolute no-training claim until the provider contract
is verified, per `docs/privacy.md`: "Provider retention and model-training promises depend on the
selected provider contract and deployment settings; they must be verified before public legal copy
makes those claims." Founder sign-off requested on this gate.

### 5. Repo variables not readable by night lab
`gh variable list` returned HTTP 403 (Resource not accessible by integration). NIGHT_LAB_* variables
could not be confirmed; defaults were used (research-only, low risk). If the night lab should read
these, the workflow needs `actions: read` variable access.

## No Critical Issues
- No security or privacy concerns: the report preserves the secret-filter-before-send boundary and
  explicitly rejects "local-only" claims (keeping "local-filtered, not local-only").
- No code was modified; no dependencies changed; no new data flows proposed.
