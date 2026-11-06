# Shared by item1.sh / item2.sh (qa-rc-0150-mac.yml). Source with: out=<dir>; . lib.sh
# Env: INSTALL_ID (qa-…), UNVIBE_QA_FLAG_TOKEN, RUNNER_TEMP. Needs gk-setup.sh to have run (gkwin, screenshot grants).
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
W="$RUNNER_TEMP/gkwin"; R="$RUNNER_TEMP/rcmac"
ud="$HOME/Library/Application Support/Unvibe"
udb="$HOME/Library/Application Support/com.apple.TCC/TCC.db"
r() { echo "$*" | tee -a "$out/report.txt"; }
t() { perl -e 'alarm shift @ARGV; exec @ARGV' "$@"; } # hard limit for anything that can wait on an unanswered dialog
utcc() { sqlite3 "$udb" "$1" 2>/dev/null || sudo sqlite3 "$udb" "$1"; }
# The user TCC row macOS writes when the Automation question for Unvibe → System Events is answered.
events_row() { utcc "SELECT auth_value||' auth_reason='||auth_reason||' last_modified='||datetime(last_modified,'unixepoch') FROM access WHERE service='kTCCServiceAppleEvents' AND client='com.unvibe.app' AND indirect_object_identifier='com.apple.systemevents';"; }
flag() { # <label>: POST the id as QA until the server has the install row (the app registers on launch)
  local i code answer body
  for i in $(seq 1 12); do
    answer=$(printf 'authorization: Bearer %s\n' "$UNVIBE_QA_FLAG_TOKEN" | curl -s -m 30 -w '\n%{http_code}' \
      -X POST https://api.unvibe.site/api/v1/admin/qa-install -H @- -H 'content-type: application/json' \
      --data "{\"installId\":\"$INSTALL_ID\"}") || answer=$'\ncurl failed'
    code=$(printf '%s' "$answer" | tail -n 1); body=$(printf '%s' "$answer" | head -n 1)
    [ "$code" = 200 ] && [[ $body == *'"matched":true'* ]] && { r "QA flag ($1) $INSTALL_ID: $code $body"; return 0; }
    sleep 5
  done
  r "QA flag ($1) $INSTALL_ID: $code $body (no matched:true after 60 s)"; return 1
}
seed_profile() { # <theme>: a set-up profile, panel at its 420x460 minimum, send agreement given, this run's qa- id
  rm -rf "$ud"; mkdir -p "$ud"
  printf '{"installId":"%s"}' "$INSTALL_ID" > "$ud/unvibe-store.json"
  printf '{"settingsRevision":8,"appearanceRevision":2,"onboarded":true,"theme":"%s","lastWidgetBounds":{"x":40,"y":60,"width":420,"height":460}}' "$1" > "$ud/unvibe-settings.json"
  printf '{"records":[{"items":["ai_send","terms","age_18"],"provider":"unvibe","policyVersion":"2026-10-30","agreedAt":"%s"}]}' "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" > "$ud/unvibe-consent.json"
  r "profile seeded: install id $INSTALL_ID, theme $1, onboarded, panel 420x460 at 40,60, send agreement 2026-10-30"
}
build_rcmac() { # the helper, allowed to read the UI, post keys/clicks and take pictures (as gk-setup.sh does for gkwin)
  swiftc -O -o "$R" "$here/rcmac.swift" || return 1
  local db="/Library/Application Support/com.apple.TCC/TCC.db" s
  for s in kTCCServiceAccessibility kTCCServiceScreenCapture kTCCServicePostEvent; do
    sudo sqlite3 "$db" "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier,flags) VALUES('$s','$R',1,2,4,1,'UNUSED',0);"
  done
}
launch() { # Unvibe through LaunchServices (so macOS asks about Unvibe itself), with its debug port for reading colours
  open -a /Applications/Unvibe.app --args --remote-debugging-port=0
  local i; for i in $(seq 1 40); do pgrep -x Unvibe > /dev/null && break; sleep 0.5; done
  r "Unvibe $(defaults read /Applications/Unvibe.app/Contents/Info.plist CFBundleShortVersionString) started: pid $(pgrep -x Unvibe | head -1)"
}
quit_app() { osascript -e 'tell application id "com.unvibe.app" to quit' > /dev/null 2>&1; sleep 2; pkill -x Unvibe 2>/dev/null; sleep 1; }
