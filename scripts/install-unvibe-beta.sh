#!/usr/bin/env bash
# Private beta installer. Downloads with curl so macOS never quarantines the app.
set -euo pipefail

TAG="${UNVIBE_BETA_TAG:-v0.1.11-beta-onboard}"
ASSET="${UNVIBE_BETA_ASSET:-Unvibe-0.1.11-beta-arm64-unsigned.dmg}"
URL="https://github.com/ShadowEsu/Unvibe/releases/download/${TAG}/${ASSET}"
DEST="/Applications/Unvibe.app"
TRACK="https://unvibe.site/api/install/event"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Unvibe beta is macOS only."
  exit 1
fi
if [ "$(uname -m)" != "arm64" ]; then
  echo "This beta is Apple silicon only (M1, M2, M3, or M4)."
  exit 1
fi

work="$(mktemp -d /tmp/unvibe-beta-XXXX)"
mountPoint="$work/volume"
device=""
cleanup() {
  if [ -n "$device" ]; then
    hdiutil detach "$device" -force >/dev/null 2>&1 || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT

echo "Downloading Unvibe beta…"
curl -fL --progress-bar "$URL" -o "$work/Unvibe.dmg"
xattr -cr "$work/Unvibe.dmg" 2>/dev/null || true

mkdir -p "$mountPoint"
attachOut="$(hdiutil attach -nobrowse -readonly -mountpoint "$mountPoint" "$work/Unvibe.dmg")"
device="$(printf '%s\n' "$attachOut" | awk '/^\/dev\/disk/ { print $1; exit }')"
if [ ! -d "$mountPoint/Unvibe.app" ]; then
  echo "The disk image did not contain Unvibe.app."
  exit 1
fi

echo "Installing to Applications…"
if [ -d "$DEST" ]; then
  rm -rf "$DEST"
fi
ditto "$mountPoint/Unvibe.app" "$DEST"
xattr -cr "$DEST"

echo "Opening Unvibe…"
open "$DEST"
curl -fsS -m 4 -X POST "$TRACK" -H "Content-Type: application/json" -d '{"event":"installed"}' >/dev/null 2>&1 || true
echo "Done. If macOS still blocks it, run: xattr -cr /Applications/Unvibe.app && open /Applications/Unvibe.app"
