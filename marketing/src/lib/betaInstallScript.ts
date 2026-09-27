export const BETA_INSTALL_TAG = "v0.1.12-beta-public";
export const BETA_INSTALL_ASSET = "Unvibe-0.1.12-beta-arm64-unsigned.dmg";
export const BETA_WINDOWS_ASSET = "Unvibe-0.1.12-win-x64-portable.exe";

export const BETA_WINDOWS_DOWNLOAD_URL =
  `https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/${BETA_WINDOWS_ASSET}`;
export const BETA_MAC_DOWNLOAD_URL =
  `https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/${BETA_INSTALL_ASSET}`;

/**
 * Kept for existing beta testers only. Public CTAs use direct, verified release updates.
 * This installer refuses unsigned or unnotarized software and never clears quarantine.
 */
export function betaInstallScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

TAG="\${UNVIBE_BETA_TAG:-${BETA_INSTALL_TAG}}"
ASSET="\${UNVIBE_BETA_ASSET:-${BETA_INSTALL_ASSET}}"
URL="https://github.com/ShadowEsu/Unvibe/releases/download/\${TAG}/\${ASSET}"
CHECKSUM_URL="\${URL}.sha256"
DEST="/Applications/Unvibe.app"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This installer is for macOS. Open https://unvibe.site for platform status."
  exit 1
fi
if [ "$(uname -m)" != "arm64" ]; then
  echo "This build is Apple silicon only."
  exit 1
fi

work="$(mktemp -d /tmp/unvibe-beta-XXXX)"
mountPoint="$work/volume"
device=""
cleanup() {
  if [ -n "$device" ]; then hdiutil detach "$device" -force >/dev/null 2>&1 || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

curl --fail --location --proto '=https' --tlsv1.2 --progress-bar "$URL" -o "$work/Unvibe.dmg"
curl --fail --location --proto '=https' --tlsv1.2 --silent --show-error "$CHECKSUM_URL" -o "$work/Unvibe.dmg.sha256"
expected="$(awk 'NR == 1 { print $1 }' "$work/Unvibe.dmg.sha256")"
actual="$(shasum -a 256 "$work/Unvibe.dmg" | awk '{ print $1 }')"
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "Checksum verification failed. Nothing was installed."
  exit 1
fi

mkdir -p "$mountPoint"
attachOut="$(hdiutil attach -nobrowse -readonly -mountpoint "$mountPoint" "$work/Unvibe.dmg")"
device="$(printf '%s\\n' "$attachOut" | awk '/^\\/dev\\/disk/ { print $1; exit }')"
if [ ! -d "$mountPoint/Unvibe.app" ]; then
  echo "The verified disk image did not contain Unvibe.app."
  exit 1
fi

if ! spctl --assess --type execute --verbose=2 "$mountPoint/Unvibe.app"; then
  echo "This release is not Developer ID signed and notarized. Refusing to install it."
  exit 1
fi

if [ -d "$DEST" ]; then rm -rf "$DEST"; fi
ditto "$mountPoint/Unvibe.app" "$DEST"
echo "Verified Unvibe installed. Open it from Applications."
`;
}

/** Existing tester helper. It validates the immutable asset and Authenticode signature before launch. */
export function betaWindowsInstallScript(): string {
  return `\$ErrorActionPreference = "Stop"
\$ProgressPreference = "SilentlyContinue"
\$tag = if (\$env:UNVIBE_BETA_TAG) { \$env:UNVIBE_BETA_TAG } else { "${BETA_INSTALL_TAG}" }
\$asset = if (\$env:UNVIBE_BETA_ASSET) { \$env:UNVIBE_BETA_ASSET } else { "${BETA_WINDOWS_ASSET}" }
\$url = "https://github.com/ShadowEsu/Unvibe/releases/download/\$tag/\$asset"
\$checksumUrl = "\$url.sha256"
\$work = Join-Path ([System.IO.Path]::GetTempPath()) ("unvibe-" + [guid]::NewGuid().ToString("N"))
\$dest = Join-Path \$work \$asset
\$checksumFile = "\$dest.sha256"

if (\$env:OS -notlike "*Windows*") { throw "This installer is for Windows. Open https://unvibe.site for platform status." }
New-Item -ItemType Directory -Force -Path \$work | Out-Null
try {
  Invoke-WebRequest -Uri \$url -OutFile \$dest -UseBasicParsing -MaximumRedirection 8
  Invoke-WebRequest -Uri \$checksumUrl -OutFile \$checksumFile -UseBasicParsing -MaximumRedirection 8
  \$expected = ((Get-Content \$checksumFile -Raw).Trim() -split '\\s+')[0].ToLowerInvariant()
  \$actual = (Get-FileHash -Algorithm SHA256 -Path \$dest).Hash.ToLowerInvariant()
  if (-not \$expected -or \$actual -ne \$expected) { throw "Checksum verification failed. Nothing was launched." }
  \$signature = Get-AuthenticodeSignature -FilePath \$dest
  if (\$signature.Status -ne "Valid") { throw "This release is not Authenticode signed. Refusing to launch it." }
  Start-Process \$dest
} finally {
  if (Test-Path \$work) { Remove-Item -Recurse -Force \$work }
}
`;
}
