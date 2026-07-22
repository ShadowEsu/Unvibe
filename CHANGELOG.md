# Changelog

All notable, user-facing changes to Unvibe. This project aims to follow
[Keep a Changelog](https://keepachangelog.com/) and semantic versioning once it
reaches a public release.

## [Unreleased]

### Fixed
- **The app now appears in the Dock and menu bar on macOS.** The desktop app
  shipped with no icon assets, so the menu-bar item rendered invisibly and the
  Dock icon was blank. Unvibe now has a proper branded icon set (app icon,
  retina-ready menu-bar template, and a multi-resolution `.icns` for packaging),
  and the menu-bar item falls back to an embedded glyph so it can never render
  invisibly again.

### Added
- `app/scripts/gen-icons.py` — a dependency-free generator that renders the
  Unvibe icon set from a signed-distance field, so the assets are reproducible.
- macOS hardened-runtime entitlements (`app/build/entitlements.mac.plist`),
  required for `npm run dist:dmg` packaging.
- Regression tests that fail if the icon assets go missing or malformed.

### Internal
- `scripts/build.mjs` now copies the retina tray asset and warns loudly (instead
  of silently) if any icon asset is missing at build time.
