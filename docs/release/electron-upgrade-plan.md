# Electron and packaging-tool upgrade plan

Status: required dependency-security work, outside this pass because npm's fixes require major upgrades from Electron 36 to 43 and electron-builder 25 to 26.

1. Checkpoint the current beta candidate and create a dedicated branch.
2. Read Electron 37–43 and electron-builder 26 breaking-change/migration notes. Inventory macOS/Node/Chromium minimums, sandbox/context-isolation defaults, IPC, permissions, clipboard selection capture, window-open handling, hardened runtime, entitlements, DMG, signing, and notarization changes.
3. Upgrade electron-builder and package a signed-equivalent unsigned artifact first; verify artifact layout/checksum.
4. Upgrade Electron one supported major at a time or use a justified direct jump with bisectable commits.
5. Run core tests plus real Accessibility/clipboard capture, widget/window lifecycle, multi-display, protocol/window-open, offline/restart, memory/CPU, packaging, signing/notarization, and clean-machine QA.
6. Re-run `npm audit`; remove advisory IDs from the allowlist only when resolved and attach the final audit report.

Current exposure review: the app does not call move-to-Applications, offscreen rendering, USB selection, download APIs, custom protocol handlers, service-worker APIs, or permission callbacks. It does use clipboard text, login-item settings on macOS, and a restrictive `setWindowOpenHandler`; API non-use reduces some exploit paths but is not a substitute for upgrading.
