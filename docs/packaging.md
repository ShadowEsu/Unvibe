# macOS packaging & release readiness

Status: **build-configured, not packaged in this run, signed, or notarized.** The app compiles and
runs in development via `npm start`.
Producing a signed, notarized `.dmg` requires a paid Apple Developer account and certificates
that are not present in this environment.

## What is configured
- `electron-builder` config in `app/package.json` (`build` block):
  - appId `com.unvibe.app`, productName `Unvibe`, dev-tools category.
  - Current target: unpacked macOS `dir` for **arm64 only**. Intel is not configured or claimed.
  - **Hardened runtime on**, entitlements at `build/entitlements.mac.plist`.
  - `NSAccessibilityUsageDescription` in Info.plist (the one permission we request).
- Entitlements request only: JIT (Electron), network client. **No** screen-recording, input-
  monitoring, camera, or mic entitlements — the app doesn't use them.

## Manual steps you must complete (require your Apple credentials)
1. `cd app && npm install` (pulls `electron-builder`).
2. Commit or generate the approved app icon during release assembly. A local
   `app/build/icon.icns` exists in this workspace, but `build/` is ignored and the icon is not in
   the repository, so a clean checkout cannot package it yet.
3. Apple Developer setup: create a **Developer ID Application** certificate (for direct .dmg) or
   an **App Store** distribution certificate (for the Mac App Store).
4. Set signing env for electron-builder:
   - `CSC_LINK` / `CSC_KEY_PASSWORD` (certificate), and for notarization
     `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
5. `npm run dist` to build. electron-builder will sign; add notarization config (`afterSign` /
   `notarize`) before distributing.
6. Test: clean install, upgrade install, uninstall (drag to Trash + remove
   `~/Library/Application Support/unvibe-app`), offline startup, missing-permission startup.

## Honest status
- ❌ Not code-signed (no certificate here).
- ❌ Not notarized.
- ⚠️ A local `.icns` exists but is not committed/reproducible from a clean checkout.
- ❌ Not submitted to the App Store.
- ✅ Hardened-runtime config, entitlements, and permission usage strings exist for arm64.
- ⚠️ `launchAtLogin` logs "Operation not permitted" when run unpackaged via `electron .`; it works
  from a signed, packaged app bundle.
