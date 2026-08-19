export const BETA_INSTALL_TAG = "v0.1.11-beta-onboard";
export const BETA_INSTALL_ASSET = "Unvibe-0.1.11-beta-arm64-unsigned.dmg";
export const BETA_WINDOWS_ASSET = "Unvibe-0.1.11-win-x64-portable.exe";
export const BETA_INSTALL_TRACK_URL = "https://unvibe.site/api/install/event";

/** Private beta installer. Curl download so macOS never quarantines the app. */
export function betaInstallScript(): string {
  return `#!/usr/bin/env bash
# Private beta installer. Downloads with curl so macOS never quarantines the app.
set -euo pipefail

TAG="\${UNVIBE_BETA_TAG:-${BETA_INSTALL_TAG}}"
ASSET="\${UNVIBE_BETA_ASSET:-${BETA_INSTALL_ASSET}}"
URL="https://github.com/ShadowEsu/Unvibe/releases/download/\${TAG}/\${ASSET}"
DEST="/Applications/Unvibe.app"
TRACK="${BETA_INSTALL_TRACK_URL}"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "On Windows run: irm https://unvibe.site/install.ps1 | iex"
  echo "This installer is for macOS."
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
device="$(printf '%s\\n' "$attachOut" | awk '/^\\/dev\\/disk/ { print $1; exit }')"
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
`;
}

/** Private beta installer. Downloads a portable Windows exe with the same 30 explanation trial. */
export function betaWindowsInstallScript(): string {
  return `# Unvibe private beta installer for Windows. 30 AI explanations. Unsigned.
# irm https://unvibe.site/install.ps1 | iex
\$ErrorActionPreference = "Stop"
\$tag = if (\$env:UNVIBE_BETA_TAG) { \$env:UNVIBE_BETA_TAG } else { "${BETA_INSTALL_TAG}" }
\$asset = if (\$env:UNVIBE_BETA_ASSET) { \$env:UNVIBE_BETA_ASSET } else { "${BETA_WINDOWS_ASSET}" }
\$url = "https://github.com/ShadowEsu/Unvibe/releases/download/\$tag/\$asset"
\$destDir = Join-Path \$env:LOCALAPPDATA "Unvibe"
\$dest = Join-Path \$destDir "Unvibe.exe"
\$track = "${BETA_INSTALL_TRACK_URL}"

if (\$env:OS -notlike "*Windows*") {
  Write-Error "This installer is for Windows. On a Mac run: curl -fsSL https://unvibe.site/install.sh | bash"
}

New-Item -ItemType Directory -Force -Path \$destDir | Out-Null
Write-Host "Downloading Unvibe beta..."
Invoke-WebRequest -Uri \$url -OutFile \$dest -UseBasicParsing
Unblock-File -Path \$dest
Write-Host "Opening Unvibe..."
Start-Process \$dest
try {
  Invoke-RestMethod -Method Post -Uri \$track -ContentType "application/json" -Body '{"event":"installed"}' -TimeoutSec 4 | Out-Null
} catch {}
Write-Host "Done. Windows may warn that Unvibe is unsigned. That is expected during beta. If SmartScreen appears, choose More info, then Run anyway."
`;
}

