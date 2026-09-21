# Instant Selection Assistance decision

## Proposed decision

Keep Electron as the product shell and add a small, signed Swift helper that observes macOS selection changes through the Accessibility API. The helper sends only local selection metadata to the Electron main process. Electron keeps ownership of the secret filter, usage limits, review lifecycle, network requests, Island, widget, and companion app.

Ship the behavior behind a local feature flag with three modes:

- **Off** — existing explicit `⌘U` flow only.
- **Show Unvibe** — recommended. A stable selection shows a small local action bubble; AI runs only after the user chooses an action.
- **Auto explain** — optional. After a longer dwell, start a review automatically.

The default is **Show Unvibe**. A selection never triggers a remote request by itself.

## Why

Electron cannot reliably observe selections across native editors, browsers, and terminals. Polling the clipboard would change user state and weaken the privacy model. A narrow native observer gives the product a fast selection experience while preserving the existing local secret scan and explicit consent boundary.

## Alternatives considered

1. Keep only `⌘U`. This is safest and already works, but does not provide the requested discoverable bubble.
2. Poll the clipboard. This is easier to prototype, but it is intrusive, misses selections that are not copied, and creates privacy ambiguity.
3. Rewrite the app in Swift. This would increase scope, split the current codebase, and replace working Electron surfaces without improving the learning model.

## Tradeoffs

- Adds a native build target and code-signing responsibility.
- Requires Accessibility permission and clear onboarding copy.
- Needs careful throttling, stable-selection detection, focus handling, and multi-display positioning.
- Creates a second process to monitor, crash-recover, and version with the app.
- Preserves the existing backend contract and does not introduce a new dependency in the renderer.

## Implementation boundary

The helper may return selected text, selection bounds, source application, and a monotonically increasing selection id. It must not call the network, persist source text, read the screen, use OCR, or bypass the Electron main-process secret filter.

The Electron main process must discard stale selections, debounce locally, run classification locally, and require an explicit action before a remote request in the default mode. The bubble must avoid stealing focus and must close on selection change, Escape, app switch, or timeout.

## Acceptance checks

- Works in Cursor, VS Code, Terminal, Chrome, and Safari.
- Never sends data merely because text was selected.
- Secret filtering still runs before every remote request.
- Bubble appears beside the selection on the correct display and does not take keyboard focus.
- `⌘U` remains available and behaves as it does today.
- Off, recommended, and auto modes are keyboard-operable and have clear permission/error states.
- Native helper failure falls back to `⌘U` without breaking the companion app.
