#!/usr/bin/env bash
# Upload v1.0.0 installers to GitHub Releases from your machine.
# Run from the repo root or marketing/:
#   bash marketing/scripts/upload-release-assets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MAC="$ROOT/app/release/Unvibe-1.0.0-arm64.dmg"
WIN="$ROOT/app/release/Unvibe Setup 1.0.0.exe"
WIN_CLEAN="/tmp/Unvibe-Setup-1.0.0.exe"

if [[ ! -f "$MAC" ]]; then
  echo "Missing $MAC — run: cd app && UNVIBE_BACKEND=https://api.unvibe.site npm run dist:mac"
  exit 1
fi
if [[ ! -f "$WIN" ]]; then
  echo "Missing Windows installer at: $WIN"
  exit 1
fi

cp "$WIN" "$WIN_CLEAN"

echo "Uploading to GitHub release v1.0.0 ..."
gh release upload v1.0.0 "$MAC" "$WIN_CLEAN" --clobber

echo "Done. Verify:"
echo "  https://github.com/ShadowEsu/Unvibe/releases/tag/v1.0.0"
gh release view v1.0.0 --json assets --jq '.assets[]|{name,size}'
