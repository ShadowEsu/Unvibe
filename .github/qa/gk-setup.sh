#!/bin/bash
# Shared setup for the macOS jobs of qa-gatekeeper-proof.yml: records the OS, makes sure Gatekeeper is on,
# lets the shell take screenshots and script the UI (as a user switching those on), and builds gkwin.
# Usage: gk-setup.sh <out dir>
set -uo pipefail
out="$1"; mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"
{
  sw_vers
  echo "arch: $(uname -m)"
  echo "Gatekeeper before: $(spctl --status 2>&1)"
} | tee "$out/system.txt"
# The proof means nothing with Gatekeeper off, so it is switched on if the runner image has it off.
if ! spctl --status 2>&1 | grep -q 'assessments enabled'; then
  sudo spctl --global-enable 2>&1 || sudo spctl --master-enable 2>&1 || true
fi
echo "Gatekeeper now: $(spctl --status 2>&1)" | tee -a "$out/system.txt"
spctl --status 2>&1 | grep -q 'assessments enabled' || { echo "::error::Gatekeeper is off on this runner and could not be switched on"; exit 1; }

db="/Library/Application Support/com.apple.TCC/TCC.db"
grant() { # service client client_type
  sudo sqlite3 "$db" "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier,flags) VALUES('$1','$2',$3,2,4,1,'UNUSED',0);" 2>/dev/null || echo "TCC $1 for $2: not written"
}
events() { # client client_type target-bundle-id
  sudo sqlite3 "$db" "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier_type,indirect_object_identifier,flags) VALUES('kTCCServiceAppleEvents','$1',$2,2,4,1,0,'$3',0);" 2>/dev/null || echo "TCC AppleEvents $1 -> $3: not written"
}
prov=/usr/local/opt/runner/provisioner/provisioner
for p in /bin/bash /usr/bin/osascript /usr/sbin/screencapture "$prov" "$RUNNER_TEMP/gkwin"; do
  grant kTCCServiceAccessibility "$p" 1
  grant kTCCServiceScreenCapture "$p" 1
  grant kTCCServicePostEvent "$p" 1
done
grant kTCCServiceAccessibility com.apple.systemevents 0
for p in /bin/bash /usr/bin/osascript "$prov"; do
  for t in com.apple.systemevents com.apple.finder com.apple.systempreferences; do events "$p" 1 "$t"; done
done

swiftc -O -o "$RUNNER_TEMP/gkwin" "$here/gkwin.swift"
echo "gkwin built"
