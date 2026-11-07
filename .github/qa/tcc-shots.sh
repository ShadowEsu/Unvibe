#!/bin/bash
# QA stills for #242's help pages (/help/shortcut, /help/accessibility; unvibe-support, Fri 6 Nov), from the RELEASED
# 0.1.49 Apple-silicon DMG on macOS 15. No hosted-AI call. In order:
#   1 first launch as a user opens it (plain double-click, no setup seeded): when macOS asks about System Events, the
#     question's picture, and the answer ANSWER (deny = Don't Allow, the help page's case; allow = Allow)
#   2 System Settings › Privacy & Security › Automation: the Unvibe entry and its System Events switch (picture of the
#     window + the rows' positions, for a crop to the Unvibe rows only, Security C-4)
#   3 Unvibe's own Settings › General › Allow Accessibility pressed (the real button, through the app's debug port):
#     the app's Accessibility block before and after, macOS's question, and the Accessibility pane it opens
# Usage: tcc-shots.sh <out dir>    Env: ANSWER (deny|allow), INSTALL_ID (qa-…), UNVIBE_QA_FLAG_TOKEN, RUNNER_TEMP
set +e -uo pipefail
out="$1"; mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"
W="$RUNNER_TEMP/gkwin"
r() { echo "$*" | tee -a "$out/report.txt"; }
t() { perl -e 'alarm shift @ARGV; exec @ARGV' "$@"; }
V=0.1.49
ud="$HOME/Library/Application Support/Unvibe"
udb="$HOME/Library/Application Support/com.apple.TCC/TCC.db"; sdb="/Library/Application Support/com.apple.TCC/TCC.db"
r "TCC SHOTS on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m); answer to the System Events question: $ANSWER"

flag() { # <label>
  local i answer code matched
  for i in $(seq 1 12); do
    answer=$(printf 'authorization: Bearer %s\n' "$UNVIBE_QA_FLAG_TOKEN" | curl -s -w '\n%{http_code}' \
      -X POST https://api.unvibe.site/api/v1/admin/qa-install -H @- -H 'content-type: application/json' \
      --data "{\"installId\":\"$INSTALL_ID\"}") || answer=$'\ncurl failed'
    code=$(printf '%s' "$answer" | tail -n 1); matched=$(printf '%s' "$answer" | head -n 1 | grep -o '"matched":[a-z]*' | cut -d: -f2)
    if [ "$1" = pre ]; then r "QA pre-flag: $code matched=${matched:-none}"; [ "$code" = 200 ]; return; fi
    [ "$code" = 200 ] && [ "$matched" = true ] && { r "QA flag ($1): 200 matched=true"; return 0; }
    sleep 5
  done
  r "QA flag ($1): $code matched=${matched:-none} after 60 s"; return 1
}
# A Privacy & Security pane, pictured (window + screen). System Settings' lists don't answer System Events here
# (run 42342531391: "Connection is invalid", timeouts), so rows are reached by position on this runner image and the
# pictures are cropped to the Unvibe rows afterwards (Security C-4).
pane() { # <label> <url> [after-open command…]
  local label="$1" url="$2"; shift 2
  open "$url"; sleep 8
  local d i x y w h
  d=$("$W" find "System Settings" || true)
  if [ -z "$d" ]; then r "FAIL  $label: no System Settings window"; screencapture -x "$out/$label-full-screen.png"; return 1; fi
  read -r i x y w h <<< "$d"
  [ $# -gt 0 ] && { "$@" "$x" "$y"; sleep 3; }
  screencapture -x -o -l "$i" "$out/$label-window.png"
  screencapture -x "$out/$label-full-screen.png"
  r "$label: System Settings window ${w}x${h} at $x,$y (picture $label-window.png)"
}
# Automation: the app rows are collapsed; Unvibe's chevron sits at (245, 352) in the 715x625 window on macos-15
# (run 42342531391: ankarund … Terminal, Unvibe sorted last). Clicking it shows Unvibe's System Events switch.
expand_unvibe() { "$W" click $(( $1 + 245 )) $(( $2 + 352 )); }
# Accessibility: the list runs past the window; Unvibe sorts after Terminal, so scroll the list to its end.
scroll_list() { "$W" scroll $(( $1 + 460 )) $(( $2 + 350 )) -5 12; }
prompts() { # <label>: every system question on screen, pictured
  "$W" list > "$out/windows-$1.txt"
  screencapture -x "$out/$1-full-screen.png"
  local o d i x y w h
  for o in UserNotificationCenter universalAccessAuthWarn CoreServicesUIAgent SecurityAgent tccd; do
    d=$("$W" find "$o" || true); [ -n "$d" ] || continue
    read -r i x y w h <<< "$d"
    screencapture -x -o -l "$i" "$out/$1-$o.png"
    r "  PROMPT $1: $o ${w}x${h} at $x,$y (picture $1-$o.png)"
  done
}

# The released DMG, checked against the release's own checksum.
dmg="$HOME/Downloads/Unvibe-$V-mac-arm64.dmg"
curl -fsSL -o "$dmg" "https://github.com/ShadowEsu/Unvibe/releases/download/v$V/Unvibe-$V-mac-arm64.dmg"
want=$(curl -fsSL "https://github.com/ShadowEsu/Unvibe/releases/download/v$V/SHA256SUMS-mac.txt" | awk -v a="Unvibe-$V-mac-arm64.dmg" '$2==a{print $1}')
got=$(shasum -a 256 "$dmg" | cut -d' ' -f1)
r "DMG sha256 $got; SHA256SUMS-mac.txt $want; $([ "$got" = "$want" ] && echo match || echo MISMATCH)"
[ "$got" = "$want" ] || { r "FAIL  the DMG doesn't match the release checksum"; exit 1; }
mnt="$RUNNER_TEMP/mnt"; mkdir -p "$mnt"
hdiutil attach -nobrowse -readonly -mountpoint "$mnt" "$dmg" > /dev/null && ditto "$mnt/Unvibe.app" /Applications/Unvibe.app; hdiutil detach "$mnt" -force > /dev/null 2>&1
# Gatekeeper's first-open steps are covered by qa-first-open.yml; here the app opens as it does after Open Anyway.
xattr -cr /Applications/Unvibe.app
r "installed $(defaults read /Applications/Unvibe.app/Contents/Info.plist CFBundleShortVersionString)"

rm -rf "$ud"; mkdir -p "$ud"; printf '{"installId":"%s"}' "$INSTALL_ID" > "$ud/unvibe-store.json"
flag pre || { r "FAIL  QA pre-flag: not 200, so nothing is launched"; exit 1; }

# 1 First launch, as a user opens it.
t0=$(date +%s); open /Applications/Unvibe.app
q=""; for i in $(seq 1 60); do q=$("$W" find UserNotificationCenter || true); [ -n "$q" ] && break; sleep 1; done
if [ -n "$q" ]; then
  r "System Events question on screen $(( $(date +%s) - t0 )) s after the first launch (no key pressed, nothing selected)"
  prompts 1-system-events-question
  read -r _ px py pw ph <<< "$q"
  # Buttons by position (the window doesn't answer System Events): Don't Allow left, Allow right, 30 points up.
  if [ "$ANSWER" = allow ]; then "$W" click $(( px + pw * 3 / 4 )) $(( py + ph - 30 )); else "$W" click $(( px + pw / 4 )) $(( py + ph - 30 )); fi
  sleep 3
  # Don't Allow didn't take on the first click in run 42342531391 (the question stayed, no TCC row): click once more,
  # then Escape, which is the question's cancel (Don't Allow) key.
  if [ "$ANSWER" = deny ] && "$W" find UserNotificationCenter > /dev/null; then
    "$W" click $(( px + pw / 4 )) $(( py + ph - 30 )); sleep 3
    "$W" find UserNotificationCenter > /dev/null && { osascript -e 'tell application "System Events" to key code 53' > /dev/null 2>&1; sleep 3; r "  Don't Allow: second click didn't close it; pressed Escape"; }
  fi
  r "pressed $([ "$ANSWER" = allow ] && echo Allow || echo "Don't Allow"); question still on screen: $("$W" find UserNotificationCenter > /dev/null && echo yes || echo no)"
else
  r "NOTE  no System Events question within 60 s of the first launch"; prompts 1-no-question
fi
sleep 5; screencapture -x "$out/1-after-answer-full-screen.png"
flag first-contact || r "FAIL  QA flag after first contact"
row=$(sqlite3 "$udb" "SELECT client||' -> '||indirect_object_identifier||' auth_value='||auth_value FROM access WHERE service='kTCCServiceAppleEvents' AND client LIKE '%unvibe%'" 2>/dev/null || sudo sqlite3 "$udb" "SELECT client||' -> '||indirect_object_identifier||' auth_value='||auth_value FROM access WHERE service='kTCCServiceAppleEvents' AND client LIKE '%unvibe%'")
r "user TCC Automation rows for Unvibe: ${row:-none} (auth_value 0 = denied, 2 = allowed)"

# 2 The Automation pane.
pane 2-automation "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation" expand_unvibe
osascript -e 'tell application "System Settings" to quit' > /dev/null 2>&1; sleep 2

# 3 Unvibe's own Allow Accessibility. Relaunch through LaunchServices with the debug port, set up (onboarded, light).
osascript -e 'tell application id "com.unvibe.app" to quit' > /dev/null 2>&1; sleep 3; pkill -x Unvibe 2>/dev/null; sleep 1
python3 - "$ud/unvibe-settings.json" <<'PY'
import json, sys, os
p = sys.argv[1]
s = json.load(open(p)) if os.path.exists(p) else {}
s.update({"onboarded": True, "theme": "light"})
json.dump(s, open(p, "w"))
PY
open -a /Applications/Unvibe.app --args --remote-debugging-port=9229; sleep 10
cp "$here/tcc-settings.mjs" "$RUNNER_TEMP/pw/"  # an ES module finds playwright only next to its own node_modules
t 120 node "$RUNNER_TEMP/pw/tcc-settings.mjs" "$out" > "$out/tcc-settings.log" 2>&1 &
cdp=$!
a=""; for i in $(seq 1 45); do a=$("$W" find universalAccessAuthWarn || true); [ -n "$a" ] && break; sleep 1; done
sleep 2; prompts 3-accessibility-question
[ -n "$a" ] || r "NOTE  macOS's Accessibility question (universalAccessAuthWarn) not seen within 45 s of the button"
wait $cdp; r "app side: $(tr '\n' ' ' < "$out/tcc-settings.log" | cut -c1-600)"
sleep 3
pane 3-accessibility "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility" scroll_list
row=$(sudo sqlite3 "$sdb" "SELECT client||' auth_value='||auth_value FROM access WHERE service='kTCCServiceAccessibility' AND client LIKE '%unvibe%'" 2>/dev/null)
r "system TCC Accessibility rows for Unvibe: ${row:-none}"
osascript -e 'tell application id "com.unvibe.app" to quit' > /dev/null 2>&1; sleep 2; pkill -x Unvibe 2>/dev/null
grep -q '^FAIL' "$out/report.txt" && exit 1
exit 0
