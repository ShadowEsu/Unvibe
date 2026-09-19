# Architecture

See [UNVIBE_ARCHITECTURE_CURRENT.md](./UNVIBE_ARCHITECTURE_CURRENT.md) for the living audit.

Unvibe is desktop-first. Electron main owns git, secret filtering, speech flags, knowledge JSON, and every network call. Renderers are sandboxed. The Next.js service in `web/` streams explanations and stores metadata. The backend never reads a repository.
