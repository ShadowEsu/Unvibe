import { AsyncLocalStorage } from 'node:async_hooks';

// Next's request scope (cookies(), headers()) binds to globalThis.AsyncLocalStorage when its modules
// load; its server installs that global first. Import this module before any `next/*` module.
Object.assign(globalThis, { AsyncLocalStorage });
