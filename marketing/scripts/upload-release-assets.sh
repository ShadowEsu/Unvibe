#!/usr/bin/env bash
# Upload v1.0.0 installers to GitHub Releases.
# Prefer browser upload if this fails with tls: bad record MAC (common on large files).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MAC="$ROOT/app/release/Unvibe-1.0.0-arm64.dmg"
WIN_SRC="$ROOT/app/release/Unvibe Setup 1.0.0.exe"
WIN_CLEAN="/tmp/Unvibe-Setup-1.0.0.exe"
TAG="v1.0.0"

# GitHub large uploads often fail over HTTP/2 (tls: bad record MAC).
export GODEBUG=http2client=0

if [[ ! -f "$MAC" ]]; then
  echo "Missing $MAC"
  echo "Build with: cd app && UNVIBE_BACKEND=https://api.unvibe.site PATH=\"\$PWD/.tools-bin:\$PATH\" npx electron-builder --mac dmg --arm64"
  exit 1
fi
if [[ ! -f "$WIN_SRC" ]]; then
  echo "Missing $WIN_SRC"
  exit 1
fi

cp "$WIN_SRC" "$WIN_CLEAN"

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

REL_ID="$(gh api "repos/ShadowEsu/Unvibe/releases/tags/${TAG}" --jq .id)"
TOKEN="$(gh auth token)"
echo "Release id: $REL_ID"
echo ""
echo "If CLI upload keeps failing, open this and drag the two files in:"
echo "  https://github.com/ShadowEsu/Unvibe/releases/tag/${TAG}"
echo "  Files:"
echo "    $MAC"
echo "    $WIN_CLEAN"
echo ""

upload_one() {
  local file="$1"
  local name="$2"
  local tries=0
  local code=""

  while [[ $tries -lt 5 ]]; do
    tries=$((tries + 1))
    echo "Uploading $name (try $tries) — $(wc -c <"$file" | tr -d ' ') bytes"
    code="$(
      curl --http1.1 --fail-with-body \
        --retry 0 \
        -sS -o "/tmp/gh-asset-${name}.json" -w "%{http_code}" \
        -X POST \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        -H "Content-Type: application/octet-stream" \
        --data-binary @"${file}" \
        "https://uploads.github.com/repos/ShadowEsu/Unvibe/releases/${REL_ID}/assets?name=${name}" \
        || true
    )"
    if [[ "$code" == "201" ]]; then
      echo "OK $name"
      return 0
    fi
    echo "HTTP $code — retrying in 3s..."
    sleep 3
  done

  # Last resort: gh (sometimes works when curl fails, or vice versa)
  if gh release upload "$TAG" "$file" --clobber; then
    echo "OK $name via gh"
    return 0
  fi

  echo "FAILED $name"
  return 1
}

# Delete existing assets with the same names so re-upload is clean
for name in Unvibe-1.0.0-arm64.dmg Unvibe-Setup-1.0.0.exe; do
  asset_id="$(gh api "repos/ShadowEsu/Unvibe/releases/${REL_ID}/assets" --jq ".[] | select(.name==\"${name}\") | .id" 2>/dev/null || true)"
  if [[ -n "${asset_id}" ]]; then
    echo "Removing existing asset $name ($asset_id)"
    gh api -X DELETE "repos/ShadowEsu/Unvibe/releases/assets/${asset_id}" >/dev/null || true
  fi
done

fail=0
upload_one "$MAC" "Unvibe-1.0.0-arm64.dmg" || fail=1
upload_one "$WIN_CLEAN" "Unvibe-Setup-1.0.0.exe" || fail=1

echo ""
gh release view "$TAG" --json assets --jq '.assets[] | {name,size}' || true

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "CLI upload failed (tls/network). Use the browser instead:"
  echo "1. Open https://github.com/ShadowEsu/Unvibe/releases/tag/${TAG}"
  echo "2. Click Edit release (pencil)"
  echo "3. Drag these files into Attach binaries:"
  open -R "$MAC" 2>/dev/null || true
  open -R "$WIN_CLEAN" 2>/dev/null || true
  open "https://github.com/ShadowEsu/Unvibe/releases/tag/${TAG}" 2>/dev/null || true
  exit 1
fi

echo "All assets uploaded."
