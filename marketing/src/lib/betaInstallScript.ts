export const BETA_INSTALL_TAG = "v0.1.44";
export const BETA_INSTALL_ASSET = "Unvibe-0.1.44-mac-arm64.dmg";
export const BETA_WINDOWS_ASSET = "Unvibe-0.1.44-win-x64-portable.exe";
export const BETA_INSTALL_TRACK_URL = "https://unvibe.site/api/install/event";
export const BETA_INSTALL_HELP_URL = "https://unvibe.site/install-help";
/** Where both install scripts live, so people can read them before running them. */
export const BETA_INSTALL_SCRIPT_SOURCE_URL =
  "https://github.com/ShadowEsu/Unvibe/blob/main/marketing/src/lib/betaInstallScript.ts";

/** Private beta installer. Curl download so macOS never quarantines the app. */
export function betaInstallScript(): string {
  return `#!/usr/bin/env bash
# Unvibe private beta installer for macOS. Source: ${BETA_INSTALL_SCRIPT_SOURCE_URL}
# Downloads the app from GitHub releases with curl, stops unless it matches the published
# SHA-256, and copies Unvibe.app into /Applications.
# Sends one anonymous 'installed' count to unvibe.site when it finishes. No code or personal data.
set -euo pipefail

TAG="\${UNVIBE_BETA_TAG:-${BETA_INSTALL_TAG}}"
ASSET="\${UNVIBE_BETA_ASSET:-${BETA_INSTALL_ASSET}}"
URL="https://github.com/ShadowEsu/Unvibe/releases/download/\${TAG}/\${ASSET}"
DEST="/Applications/Unvibe.app"
TRACK="${BETA_INSTALL_TRACK_URL}"
HELP="${BETA_INSTALL_HELP_URL}"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "On Windows run: irm https://unvibe.site/install.ps1 | iex"
  echo "This installer is for macOS."
  exit 1
fi
if [ "$(uname -m)" != "arm64" ] && [ -z "\${UNVIBE_BETA_ASSET:-}" ]; then
  # Intel Mac: use the x64 build.
  ASSET="\${ASSET/mac-arm64/mac-x64}"
  URL="https://github.com/ShadowEsu/Unvibe/releases/download/\${TAG}/\${ASSET}"
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
stop() {
  echo "$1" >&2
  echo "For help, see $HELP" >&2
  exit 1
}

echo "Downloading Unvibe beta…"
curl -fL --progress-bar "$URL" -o "$work/Unvibe.dmg"

# Check the download against the SHA-256 published with the release. No checksum, no install.
SUMS_URL="https://github.com/ShadowEsu/Unvibe/releases/download/\${TAG}/SHA256SUMS-mac.txt"
if ! curl -fsSL -m 20 "$SUMS_URL" -o "$work/SHA256SUMS"; then
  stop "Could not download the published checksums from $SUMS_URL, so the download can't be checked. Nothing was installed."
fi
expected="$(awk -v a="$ASSET" '$2 == a || $2 == "*"a { print $1; exit }' "$work/SHA256SUMS")"
if [ -z "$expected" ]; then
  stop "The published checksums have no line for $ASSET, so the download can't be checked. Nothing was installed."
fi
actual="$(shasum -a 256 "$work/Unvibe.dmg" | awk '{ print $1 }')"
if [ "$expected" != "$actual" ]; then
  stop "The download does not match the published checksum. Nothing was installed."
fi
echo "Checksum verified."

mkdir -p "$mountPoint"
attachOut="$(hdiutil attach -nobrowse -readonly -mountpoint "$mountPoint" "$work/Unvibe.dmg")"
device="$(printf '%s\\n' "$attachOut" | awk '/^\\/dev\\/disk/ { print $1; exit }')"
if [ ! -d "$mountPoint/Unvibe.app" ]; then
  stop "The disk image did not contain Unvibe.app. Nothing was installed."
fi
# The release is signed. If the signature does not verify, stop rather than re-sign it here:
# a local re-sign changes the app's identity and macOS drops its Accessibility permission.
if ! codesign --verify --deep --strict "$mountPoint/Unvibe.app" >/dev/null 2>&1; then
  stop "The downloaded app failed its signature check. Nothing was installed, and any Unvibe you already have is unchanged."
fi

echo "Closing any running Unvibe…"
osascript -e 'tell application id "com.unvibe.app" to quit' >/dev/null 2>&1 || true
sleep 1
pkill -x Unvibe >/dev/null 2>&1 || true

echo "Installing to Applications…"
if [ -d "$DEST" ]; then
  rm -rf "$DEST"
fi
ditto "$mountPoint/Unvibe.app" "$DEST"

echo "Opening Unvibe…"
open "$DEST"
curl -fsS -m 4 -X POST "$TRACK" -H "Content-Type: application/json" -d '{"event":"installed"}' >/dev/null 2>&1 || true
echo "Done. If macOS blocks it, see ${BETA_INSTALL_HELP_URL}"
`;
}

export const BETA_WINDOWS_DOWNLOAD_URL =
  `https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/${BETA_WINDOWS_ASSET}`;
export const BETA_MAC_DOWNLOAD_URL =
  `https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/${BETA_INSTALL_ASSET}`;
/** Older Intel Macs need the x64 build; the Apple silicon one cannot run there. */
export const BETA_MAC_INTEL_DOWNLOAD_URL = BETA_MAC_DOWNLOAD_URL.replace("mac-arm64.dmg", "mac-x64.dmg");

/** Private beta installer. Downloads the portable Windows exe, which uses the free plan. */
export function betaWindowsInstallScript(): string {
  return `# Unvibe private beta installer for Windows. Free AI explanations: 30 days without an account, monthly with one. Unsigned.
# Source: ${BETA_INSTALL_SCRIPT_SOURCE_URL}
# Sends one anonymous 'installed' count to unvibe.site when it finishes. No code or personal data.
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
\$ua = "UnvibeBetaInstaller/0.1.44"

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
# Download next to the app and only replace it once the download is verified, so a failed
# update leaves the working copy in place.
\$download = "\$dest.download"
if (Test-Path \$download) { Remove-Item -Force \$download }
# throw, not exit: under irm | iex, exit closes the window before the message can be read.
function Stop-UnvibeInstall(\$message) {
  Remove-Item -Force \$download -ErrorAction SilentlyContinue
  throw "\$message Nothing was installed. For help, see ${BETA_INSTALL_HELP_URL}"
}

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
  & curl.exe -fL --retry 3 --retry-delay 2 -A \$ua -o \$download \$url
  if (\$LASTEXITCODE -eq 0 -and (Test-Path \$download)) { \$downloaded = \$true }
}
if (-not \$downloaded) {
  try {
    Invoke-WebRequest -Uri \$url -OutFile \$download -UseBasicParsing -UserAgent \$ua -MaximumRedirection 8
    \$downloaded = \$true
  } catch {
    Stop-UnvibeInstall "Could not download \$asset from release \$tag. Open \$url in a browser, or retry in PowerShell as Administrator. Details: \$_"
  }
}
if (-not (Test-Path \$download) -or (Get-Item \$download).Length -lt 1000000) {
  Stop-UnvibeInstall "The download looks incomplete. Run the install command again, or download \$url in your browser."
}
# Check the download against the SHA-256 published with the release. No checksum, no install.
\$sumsUrl = "https://github.com/ShadowEsu/Unvibe/releases/download/\$tag/SHA256SUMS-windows.txt"
try {
  \$sums = (Invoke-WebRequest -Uri \$sumsUrl -UseBasicParsing -UserAgent \$ua -MaximumRedirection 8 -TimeoutSec 20).Content
  if (\$sums -is [byte[]]) { \$sums = [System.Text.Encoding]::UTF8.GetString(\$sums) }
} catch {
  Stop-UnvibeInstall "Could not download the published checksums from \$sumsUrl, so the download can't be checked."
}
\$line = (\$sums -split "\`n") | Where-Object { (\$_.Trim() -split '\\s+')[1] -in @(\$asset, "*\$asset") } | Select-Object -First 1
if (-not \$line) { Stop-UnvibeInstall "The published checksums have no line for \$asset, so the download can't be checked." }
\$expected = (\$line.Trim() -split '\\s+')[0].ToLower()
\$actual = (Get-FileHash -Path \$download -Algorithm SHA256).Hash.ToLower()
if (\$expected -ne \$actual) { Stop-UnvibeInstall "The download does not match the published checksum." }
Write-Host "Checksum verified."

Write-Host "Closing any running Unvibe..."
Get-Process -Name Unvibe -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
try {
  Move-Item -Force -Path \$download -Destination \$dest
} catch {
  Stop-UnvibeInstall "Could not replace \$dest. Quit Unvibe from the tray, then run the install command again. Details: \$_"
}
try { Unblock-File -Path \$dest -ErrorAction Stop } catch {}

\$shortcutPath = Join-Path \$env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\Unvibe.lnk"
\$inStartMenu = \$false
try {
  \$shell = New-Object -ComObject WScript.Shell
  \$shortcut = \$shell.CreateShortcut(\$shortcutPath)
  \$shortcut.TargetPath = \$dest
  \$shortcut.WorkingDirectory = \$destDir
  \$shortcut.IconLocation = "\$dest,0"
  \$shortcut.Description = "Unvibe"
  \$shortcut.Save()
  \$inStartMenu = \$true
} catch {
  Write-Warning "Could not add Unvibe to the Start menu. Details: \$_"
}

Write-Host "Opening Unvibe..."
Start-Process \$dest
try {
  Invoke-RestMethod -Method Post -Uri \$track -ContentType "application/json" -Body '{"event":"installed"}' -TimeoutSec 4 | Out-Null
} catch {}
Write-Host "Windows may warn that Unvibe is unsigned. That is expected during beta. If SmartScreen appears, choose More info, then Run anyway."
if (\$inStartMenu) {
  Write-Host "Done. Unvibe is in your Start menu and tray."
} else {
  Write-Host "Done. Unvibe is in your tray. To open it again later, run \$dest"
}
`;
}

