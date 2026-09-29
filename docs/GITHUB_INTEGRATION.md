# GitHub integration

Not shipped as a GitHub App.

What exists: local git via the desktop (`working`, `staged`, `latest`, `branch vs base`). Blame and `git log` power Why this exists. No GitHub token is requested.

What does not exist: GitHub App credentials, org install, PR ingest, issue linking, incremental GitHub indexing.

Do not configure a personal access token for product features. When a GitHub App is added later, use read-only contents/metadata and per-repository selection.
