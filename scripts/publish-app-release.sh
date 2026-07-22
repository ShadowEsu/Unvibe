#!/usr/bin/env bash
# Publishes a desktop app release to GitHub Releases so it shows up automatically on
# unvibe.site/releases (which reads straight from the GitHub Releases API — see
# marketing/src/lib/releases.ts). Requires the GitHub CLI (`gh`) authenticated with push
# access to the repo.
#
# Usage:
#   scripts/publish-app-release.sh 0.1.0 ~/Downloads/Unvibe.dmg ~/Downloads/Unvibe-setup.exe [more files...]
#
# The tag is always prefixed "app-v" (e.g. app-v0.1.0) — that prefix is what the release
# workflow and the releases page both filter on, so builds from other parts of the repo
# never show up on the desktop app's release history.

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <version> <file> [more files...]" >&2
  echo "Example: $0 0.1.0 ~/Downloads/Unvibe.dmg ~/Downloads/Unvibe-setup.exe" >&2
  exit 1
fi

VERSION="$1"
shift
TAG="app-v${VERSION}"

for f in "$@"; do
  if [ ! -f "$f" ]; then
    echo "File not found: $f" >&2
    exit 1
  fi
done

echo "Publishing $TAG with:"
printf '  - %s\n' "$@"

gh release create "$TAG" "$@" \
  --title "Unvibe ${VERSION} (Beta)" \
  --prerelease \
  --notes "Private beta build. macOS and Windows builds are unsigned during beta."

echo ""
echo "Done. This will appear on unvibe.site/releases within a few minutes (cache TTL is 5 minutes)."
