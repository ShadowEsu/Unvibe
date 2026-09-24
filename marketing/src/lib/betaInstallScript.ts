export const BETA_INSTALL_TAG = "v0.1.12-beta-public";
export const BETA_INSTALL_ASSET = "Unvibe-0.1.12-beta-arm64-unsigned.dmg";
export const BETA_WINDOWS_ASSET = "Unvibe-0.1.12-win-x64-portable.exe";
export const BETA_INSTALL_TRACK_URL = "https://unvibe.site/api/install/event";

/** Public-beta installer. The direct .dmg is also available from the download page. */
export function betaInstallScript(): string {
  return `#!/usr/bin/env bash
# Unvibe public-beta installer. The direct .dmg is also available from unvibe.site.
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

export const BETA_WINDOWS_DOWNLOAD_URL =
  `https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/${BETA_WINDOWS_ASSET}`;
export const BETA_MAC_DOWNLOAD_URL =
  `https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/${BETA_INSTALL_ASSET}`;

/** Public-beta installer. Downloads a portable Windows exe with the same 30-explanation trial. */
export function betaWindowsInstallScript(): string {
  return `# Unvibe public-beta installer for Windows. 30 days, 50 AI explanations, and 50 selected-code reviews. Unsigned.
# Paste this in Windows PowerShell or pwsh (not Command Prompt, not Git Bash):
# irm https://unvibe.site/install.ps1 | iex
\$ErrorActionPreference = "Stop"
\$ProgressPreference = "SilentlyContinue"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

\$tag = if (\$env:UNVIBE_BETA_TAG) { \$env:UNVIBE_BETA_TAG } else { "${BETA_INSTALL_TAG}" }
\$asset = if (\$env:UNVIBE_BETA_ASSET) { \$env:UNVIBE_BETA_ASSET } else { "${BETA_WINDOWS_ASSET}" }
\$url = "https://github.com/ShadowEsu/Unvibe/releases/download/\$tag/\$asset"
\$destDir = Join-Path \$env:LOCALAPPDATA "Unvibe"
\$dest = Join-Path \$destDir "Unvibe.exe"
\$track = "${BETA_INSTALL_TRACK_URL}"
\$ua = "UnvibeBetaInstaller/0.1.12"

if (\$env:OS -notlike "*Windows*") {
  Write-Error "This installer is for Windows. On a Mac run: curl -fsSL https://unvibe.site/install.sh | bash"
  exit 1
}

if (-not \$PSVersionTable) {
  Write-Error "Run this in Windows PowerShell or pwsh, not cmd.exe. Example: irm https://unvibe.site/install.ps1 | iex"
  exit 1
}

if (\$env:PROCESSOR_ARCHITECTURE -and \$env:PROCESSOR_ARCHITECTURE -ne "AMD64" -and \$env:PROCESSOR_ARCHITECTURE -ne "ARM64") {
  Write-Warning "This beta ships an x64 Windows build. On ARM PCs, Windows may run it under emulation."
}

New-Item -ItemType Directory -Force -Path \$destDir | Out-Null
if (Test-Path \$dest) { Remove-Item -Force \$dest }

Write-Host "Checking release asset..."
try {
  \$probe = Invoke-WebRequest -Method Head -Uri \$url -UseBasicParsing -UserAgent \$ua -MaximumRedirection 8
  if (-not \$probe -or [int]\$probe.StatusCode -ge 400) {
    Write-Error "Windows beta asset is missing at \$url (HTTP \$(\$probe.StatusCode)). The Mac install still works: curl -fsSL https://unvibe.site/install.sh | bash. Or open the latest release page: https://github.com/ShadowEsu/Unvibe/releases"
    exit 1
  }
} catch {
  Write-Error "Windows beta asset is missing or unreachable at \$url. The Mac install still works: curl -fsSL https://unvibe.site/install.sh | bash. Or open https://github.com/ShadowEsu/Unvibe/releases. Details: \$_"
  exit 1
}

Write-Host "Downloading Unvibe beta from \$url ..."
\$downloaded = \$false
\$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if (\$curl) {
  & curl.exe -fL --retry 3 --retry-delay 2 -A \$ua -o \$dest \$url
  if (\$LASTEXITCODE -eq 0 -and (Test-Path \$dest)) { \$downloaded = \$true }
}
if (-not \$downloaded) {
  try {
    Invoke-WebRequest -Uri \$url -OutFile \$dest -UseBasicParsing -UserAgent \$ua -MaximumRedirection 8
    \$downloaded = \$true
  } catch {
    Write-Error "Could not download \$asset from release \$tag. Open \$url in a browser, or retry in PowerShell as Administrator. Details: \$_"
    exit 1
  }
}
if (-not (Test-Path \$dest) -or (Get-Item \$dest).Length -lt 1000000) {
  Write-Error "Download finished but the installer looks incomplete. Delete \$dest, then run the install command again, or download \$url in your browser."
  exit 1
}
try { Unblock-File -Path \$dest -ErrorAction Stop } catch {}
Write-Host "Opening Unvibe..."
Start-Process \$dest
try {
  Invoke-RestMethod -Method Post -Uri \$track -ContentType "application/json" -Body '{"event":"installed"}' -TimeoutSec 4 | Out-Null
} catch {}
Write-Host "Done. Windows may warn that Unvibe is unsigned. That is expected during beta. If SmartScreen appears, choose More info, then Run anyway."
`;
}

