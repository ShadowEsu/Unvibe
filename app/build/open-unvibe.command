#!/bin/bash
# Clears the download quarantine so an unsigned beta can launch without notarization.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="$here/Unvibe.app"
installed="/Applications/Unvibe.app"

if [ -d "$installed" ]; then
  xattr -cr "$installed"
  open "$installed"
  exit 0
fi

if [ ! -d "$app" ]; then
  osascript -e 'display alert "Unvibe was not found" message "Drag Unvibe into Applications, then run Open Unvibe again." as warning'
  exit 1
fi

xattr -cr "$app"
ditto "$app" "$installed"
xattr -cr "$installed"
open "$installed"
