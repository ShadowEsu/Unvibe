# Desktop packaging & release readiness

Unvibe is a **desktop Electron app** (`app/`), not a browser web app / PWA.
Users install a `.dmg` (Mac) or `.exe` (Windows) — they do not “install the website.”

## Honest status (2026-07-14)

| Item | Status |
|---|---|
| Mac drag-to-Applications DMG config | Ready (`npm run dist:mac`) |
| Mac `.icns` icon | Ready (`app/build/icon.icns`) |
| Windows NSIS installer config | Ready (`npm run dist:win`) |
| Windows `.ico` icon | Ready (`app/build/icon.ico`) |
| Code-signed Mac build | Not ready — `identity: null`, no Developer ID cert here |
| Apple notarization | Not ready — required for Gatekeeper on other Macs |
| Windows Authenticode / SmartScreen | Not ready — no Windows code-signing cert |
| Hosted production backend URL | Not ready — builds still default to `http://localhost:8788` unless you bake one |
| Selection / Accessibility APIs | **macOS-first** — Windows packaging installs, but selection capture is not product-complete on Windows |

**Verdict:** You can build installers locally for demos. You cannot yet ship a Gatekeeper-clean Mac download or a SmartScreen-clean Windows download to strangers until signing + a real HTTPS backend exist.

## Build installers

```bash
cd app
npm install

# If DMG build fails looking for `python`, put a working Python 3.11+ first on PATH:
#   mkdir -p .tools-bin && ln -sfn "$(which python3.11)" .tools-bin/python
#   PATH="$PWD/.tools-bin:$PATH" npm run dist:mac

# Mac: DMG + zip. DMG window shows Unvibe.app + Applications shortcut (drag to install).
PATH="${PWD}/.tools-bin:$PATH" npm run dist:mac
# → release/Unvibe-0.1.0-arm64.dmg
# → release/Unvibe-0.1.0-arm64-mac.zip

# Windows: NSIS installer (x64). Can cross-build from macOS.
npm run dist:win
# → release/Unvibe Setup 0.1.0.exe

# Both
PATH="${PWD}/.tools-bin:$PATH" npm run dist:all
```

Verified locally (unsigned):

- `app/release/Unvibe-0.1.0-arm64.dmg` (~105 MB) — drag Unvibe → Applications
- `app/release/Unvibe Setup 0.1.0.exe` (~84 MB) — Windows NSIS installer

### Bake a production backend into the binary

```bash
UNVIBE_BACKEND=https://your-api.example.com npm run dist:mac
```

Without that, the packaged app talks to `http://localhost:8788` (fine only for local demos).
Users can also override with a userData `.env`:

- Mac: `~/Library/Application Support/Unvibe/.env`
- Windows: `%APPDATA%\Unvibe\.env`

```
UNVIBE_BACKEND=https://your-api.example.com
```

## Mac install UX (what users do)

1. Open the `.dmg`
2. Drag **Unvibe** onto **Applications**
3. Launch from Applications (first run may need right-click → Open if unsigned)

## Windows install UX

1. Run `Unvibe Setup x.y.z.exe`
2. Choose install directory (NSIS allows customize)
3. Launch from Start Menu / desktop shortcut

## Signing (required before public release)

### Mac
1. Apple Developer Program — **Developer ID Application** certificate
2. Set `CSC_LINK` / `CSC_KEY_PASSWORD` (or keychain identity); remove `"identity": null`
3. Notarize with `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
4. Set `"dmg.sign": true` after signing works

### Windows
1. Authenticode certificate
2. Configure electron-builder `win.certificateFile` / `certificatePassword` (or CI secrets)
3. Expect SmartScreen reputation delay on first public downloads

## Entitlements

`app/build/entitlements.mac.plist` requests only: JIT, unsigned executable memory (Electron),
network client. No screen recording / input monitoring / camera / mic.

## Smoke test checklist before calling a build “ready”

- [ ] Clean install from DMG / NSIS on a machine that never ran Unvibe
- [ ] App talks to the intended HTTPS backend (not localhost) without a hand-written `.env`
- [ ] Offline / backend-down states show calm errors (no hang)
- [ ] Mac: Accessibility permission prompt appears and selection explain works
- [ ] Signed + notarized Mac build opens without Gatekeeper block
- [ ] Windows: installer completes; core companion UI opens (selection may still be macOS-only)
