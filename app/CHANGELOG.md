# Unvibe desktop — Changelog

All notable changes to the Unvibe desktop app (`app/`) are recorded here.
User-facing language; not raw commit messages.

## Unreleased

### Fixed
- The built app now reliably shows a **Dock icon and a menu-bar item**. Previously the app
  shipped with no bundled icon assets, so the menu-bar item was created from an empty image and
  rendered as an invisible, zero-width item, and there was no Dock icon. The real designed icons
  are now committed (`app/build/icon.png`, `icon.icns`, `trayTemplate.png`) and copied into the
  build, the app explicitly shows its Dock icon on macOS, and the menu-bar item now falls back to
  an embedded glyph if the asset is ever missing — so it can never be invisible again.

### Internal
- `app/build/` source assets (icons, entitlements) are now correctly tracked. The root
  `.gitignore`'s `build/` rule was silently excluding them, which is why they never shipped.
- Menu-bar tray creation is wrapped so a failure can no longer abort the rest of launch (floating
  bar, companion window, global shortcut).
- The build script now warns loudly when an icon asset is missing instead of failing silently.
- Added unit tests for the embedded tray-icon fallback (valid, non-empty, square PNG).
