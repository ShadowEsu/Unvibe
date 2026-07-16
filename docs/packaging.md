# macOS packaging & release readiness

Status: **unsigned arm64 staging package generated and structurally verified; not signed,
notarized, Gatekeeper-verified, or clean-machine tested.**
Producing a signed, notarized `.dmg` requires a paid Apple Developer account and certificates
that are not present in this environment.

## What is configured
- `electron-builder` config in `app/package.json` (`build` block):
  - appId `com.unvibe.app`, productName `Unvibe`, dev-tools category.
  - Current target: macOS `dir`/DMG for **arm64 only**. Intel is not configured or claimed.
  - **Hardened runtime on**, entitlements at `build/entitlements.mac.plist`.
  - `NSAccessibilityUsageDescription` in Info.plist (the one permission we request).
- Entitlements request only: JIT (Electron), network client. **No** screen-recording, input-
  monitoring, camera, or mic entitlements — the app doesn't use them.

## Manual steps you must complete (require your Apple credentials)
1. `cd app && npm install` (pulls `electron-builder`).
2. Confirm the tracked icon/tray/entitlements assets are the founder-approved final assets.
3. Apple Developer setup: create a **Developer ID Application** certificate (for direct .dmg) or
   an **App Store** distribution certificate (for the Mac App Store).
4. Set signing env for electron-builder:
   - `CSC_LINK` / `CSC_KEY_PASSWORD` (certificate), and for notarization
     `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
5. For internal unsigned staging QA, run `APP_ENV=staging UNVIBE_BACKEND=https://<approved> npm run package:local`, then `npm run verify:package`. For external distribution follow `docs/release/macos-signing-notarization.md`; do not reuse the unsigned command.
6. Test: clean install, upgrade install, uninstall (drag to Trash + remove
   `~/Library/Application Support/unvibe-app`), offline startup, missing-permission startup.

## Honest status
- ❌ Not code-signed (no certificate here).
- ❌ Not notarized.
- ✅ Required icon/tray/entitlement assets are tracked for clean-checkout packaging.
- ✅ Unsigned DMG, SHA-256, app bundle, bundle ID, and baked HTTPS staging origin were verified locally.
- ❌ Not submitted to the App Store.
- ✅ Hardened-runtime config, entitlements, and permission usage strings exist for arm64.
- ⚠️ `launchAtLogin` logs "Operation not permitted" when run unpackaged via `electron .`; it works
  from a signed, packaged app bundle.
