#!/bin/bash
# One macOS row of qa-install-matrix.yml: install Unvibe the way the site offers it, record every warning macOS shows,
# see the first launch, flag the install as QA right away, then the first explanation (first-explain.mjs).
# Usage: mac-row.sh <curl|dmg> <out dir>     Env: INSTALL_ID (qa-…), UNVIBE_QA_FLAG_TOKEN, V (release, e.g. 0.1.49)
set +e -uo pipefail
path_kind="$1"; out="$2"; mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"
W="$RUNNER_TEMP/gkwin"
r() { echo "$*" | tee -a "$out/report.txt"; }
t() { perl -e 'alarm shift @ARGV; exec @ARGV' "$@"; } # hard limit for anything that can wait on an unanswered dialog
arch=$(uname -m)
r "ROW mac-$path_kind on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $arch, $(spctl --status)"
( while true; do screencapture -x "$out/progress-$(date +%H%M%S).png"; sleep 30; done ) & shots=$!
trap 'kill $shots 2>/dev/null' EXIT

# The profile the installed app uses on its first launch gets this run's qa- install id before anything starts,
# so its very first contact with the server is already a QA id.
store_dir="$HOME/Library/Application Support/Unvibe"; store="$store_dir/unvibe-store.json"
mkdir -p "$store_dir"; printf '{"installId":"%s"}' "$INSTALL_ID" > "$store"
r "seeded install id $INSTALL_ID"
# Flagged BEFORE anything installs or launches (#201's order, the lead): the route keeps a matched:false row and the
# app's later registration stays qa=true, so a hang or a cancel never leaves this install counted as real.
pre=$(printf 'authorization: Bearer %s\n' "$UNVIBE_QA_FLAG_TOKEN" | curl -s -w '\n%{http_code}' \
  -X POST https://api.unvibe.site/api/v1/admin/qa-install -H @- -H 'content-type: application/json' \
  --data "{\"installId\":\"$INSTALL_ID\"}") || pre=$'\ncurl failed'
r "QA pre-flag before install: $(printf '%s' "$pre" | tail -n 1) $(printf '%s' "$pre" | head -n 1 | grep -o '"matched":[a-z]*')"
[ "$(printf '%s' "$pre" | tail -n 1)" = 200 ] || { r "FAIL  QA pre-flag: not 200, so nothing is installed"; exit 1; }

flag() { # POST the id as QA; retried until the server has the install row (the app registers on launch)
  local i code matched answer
  for i in $(seq 1 12); do
    answer=$(printf 'authorization: Bearer %s\n' "$UNVIBE_QA_FLAG_TOKEN" | curl -s -w '\n%{http_code}' \
      -X POST https://api.unvibe.site/api/v1/admin/qa-install -H @- -H 'content-type: application/json' \
      --data "{\"installId\":\"$INSTALL_ID\"}") || answer=$'\ncurl failed'
    code=$(printf '%s' "$answer" | tail -n 1); matched=$(printf '%s' "$answer" | head -n 1 | grep -o '"matched":[a-z]*' | cut -d: -f2)
    [ "$code" = 200 ] && [ "$matched" = true ] && { r "QA flag ($1): 200 matched=true"; return 0; }
    sleep 5
  done
  r "QA flag ($1): $code matched=${matched:-none} after 60 s"; return 1
}
prompts() { # <label>: every system prompt window on screen: picture, text, buttons
  "$W" list > "$out/windows-$1.txt"
  screencapture -x "$out/$1-full-screen.png"
  local o d i x y w h txt btn
  for o in CoreServicesUIAgent UserNotificationCenter SecurityAgent tccd coreautha; do
    d=$("$W" find "$o" || true); [ -n "$d" ] || continue
    read -r i x y w h <<< "$d"
    screencapture -x -o -l "$i" "$out/$1-$o.png"
    # The Automation consent (UserNotificationCenter) doesn't answer System Events (run 42181832386 timed out on
    # every row), so its words come from the picture.
    if [ "$o" = UserNotificationCenter ]; then r "  PROMPT $1: $o ${w}x${h} at $x,$y: words in $1-$o.png"; continue; fi
    txt=$(t 15 osascript -e "tell application \"System Events\" to tell process \"$o\" to get value of every static text of window 1" 2>&1 | tr '\n' ' ')
    btn=$(t 15 osascript -e "tell application \"System Events\" to tell process \"$o\" to get name of every button of window 1" 2>&1 | tr '\n' ' ')
    r "  PROMPT $1: $o ${w}x${h}: \"$txt\" buttons: $btn"
  done
}

case "$path_kind" in
curl)
  # The site's one-liner, as given, with only its anonymous 'installed' count sent nowhere.
  curl -fsSL https://unvibe.site/install.sh -o "$out/install.sh.live"
  sed 's#^TRACK=.*#TRACK="http://127.0.0.1:9/qa-no-count"#' "$out/install.sh.live" > "$out/install.sh.run"
  r "install.sh sha256 $(shasum -a 256 "$out/install.sh.live" | cut -d' ' -f1); run copy differs only in: $(diff "$out/install.sh.live" "$out/install.sh.run" | grep '^[<>]' | tr '\n' ' ')"
  start=$(date +%s)
  t 600 bash "$out/install.sh.run" > "$out/install.log" 2>&1; rc=$?
  r "install.sh exit $rc after $(( $(date +%s) - start )) s; last lines: $(tail -3 "$out/install.log" | tr '\n' ' ')"
  [ $rc = 0 ] || r "FAIL  install: install.sh exit $rc"
  q=$(xattr -lr /Applications/Unvibe.app 2>/dev/null | grep -c com.apple.quarantine)
  r "quarantine attributes in /Applications/Unvibe.app: $q (a Terminal download has none, so Gatekeeper doesn't ask)"
  r "install.sh pins: $(grep -E '^(TAG|ASSET)=' "$out/install.sh.live" | tr '\n' ' ')"
  iv=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' /Applications/Unvibe.app/Contents/Info.plist 2>/dev/null)
  r "$([ "$iv" = "$V" ] && echo PASS || echo FAIL)  installed version ${iv:-none} (want $V)"
  codesign --verify --deep --strict -R='identifier "com.unvibe.app" and certificate leaf = H"c9da4f618adf98911a450e041b8f336574a99d0e"' /Applications/Unvibe.app > /dev/null 2>&1 \
    && r "PASS  codesign --verify --deep --strict -R=<release pin c9da4f61> on the installed app" || r "FAIL  the installed app fails codesign -R=<release pin>"
  a=$(shasum -a 256 /Applications/Unvibe.app/Contents/Resources/app.asar | cut -d' ' -f1)
  if [ -n "${WANT_ASAR:-}" ]; then r "$([ "$a" = "$WANT_ASAR" ] && echo PASS || echo FAIL)  installed app.asar sha256 $a (want ${WANT_ASAR:0:8}…)"; else r "installed app.asar sha256 $a"; fi
  # SHA-256: install.sh installs nothing unless its DMG matches SHA256SUMS-mac.txt; the same asset, fetched again here,
  # checked against the same file.
  ca="Unvibe-$V-mac-$([ "$arch" = arm64 ] && echo arm64 || echo x64).dmg"
  curl -fsSL -o "$RUNNER_TEMP/check.dmg" "https://github.com/ShadowEsu/Unvibe/releases/download/v$V/$ca"
  cw=$(curl -fsSL "https://github.com/ShadowEsu/Unvibe/releases/download/v$V/SHA256SUMS-mac.txt" | awk -v f="$ca" '$NF==f {print $1}')
  cg=$(shasum -a 256 "$RUNNER_TEMP/check.dmg" | cut -d' ' -f1); rm -f "$RUNNER_TEMP/check.dmg"
  r "$([ -n "$cw" ] && [ "$cg" = "$cw" ] && echo PASS || echo FAIL)  $ca sha256 $cg; v$V SHA256SUMS-mac.txt says ${cw:-nothing}"
  ;;
dmg)
  asset="Unvibe-$V-mac-$([ "$arch" = arm64 ] && echo arm64 || echo x64).dmg"
  dmg="$HOME/Downloads/$asset"
  if [ -n "${DL_FILE:-}" ]; then
    # qa-first-open.yml: the file the site's own download button saved in a real browser on this runner.
    asset=$(basename "$DL_FILE"); dmg="$HOME/Downloads/$asset"
    [ "$DL_FILE" -ef "$dmg" ] || ditto "$DL_FILE" "$dmg"
    q=$(xattr -p com.apple.quarantine "$dmg" 2>/dev/null)
    if [ -n "$q" ]; then how="the browser's own quarantine mark ($q)"
    else xattr -w com.apple.quarantine "0083;$(printf '%x' "$(date +%s)");Google Chrome;$(uuidgen)" "$dmg"; how="a quarantine mark ADDED (the browser saved none)"; fi
  else
    curl -fsSL -o "$dmg" "https://github.com/ShadowEsu/Unvibe/releases/download/v$V/$asset"
    # What Safari writes on a download; curl doesn't, so it is added as a browser would.
    xattr -w com.apple.quarantine "0083;$(printf '%x' "$(date +%s)");Safari;$(uuidgen)" "$dmg"
    how="a browser's quarantine mark"
  fi
  r "downloaded $asset ($(stat -f %z "$dmg") bytes) with $how"
  open "$dmg"
  vol=""; for i in $(seq 1 60); do vol=$(ls -d /Volumes/*/Unvibe.app 2>/dev/null | head -1); [ -n "$vol" ] && break; sleep 1; done
  [ -n "$vol" ] || { r "FAIL  install: the DMG did not mount"; prompts dmg-mount; }
  vol=$(dirname "$vol")
  sleep 2; prompts dmg-opened
  # Drag to Applications: ditto keeps com.apple.quarantine as a Finder copy does.
  ditto "$vol/Unvibe.app" /Applications/Unvibe.app
  [ -n "$(xattr -p com.apple.quarantine /Applications/Unvibe.app 2>/dev/null)" ] || xattr -w com.apple.quarantine "$(xattr -p com.apple.quarantine "$dmg")" /Applications/Unvibe.app
  r "copied to /Applications; quarantine kept: $(xattr -p com.apple.quarantine /Applications/Unvibe.app 2>/dev/null || echo NONE)"
  r "spctl on the app: $(spctl --assess --type execute -vv /Applications/Unvibe.app 2>&1 | tr '\n' ' ')"
  hdiutil detach "$vol" -force > /dev/null 2>&1
  # Double-click the app (in the background: open waits while Gatekeeper's dialog is up).
  ( open /Applications/Unvibe.app 2> "$out/open-1.txt" ) &
  # Wait for Gatekeeper's verdict, not its "Verifying “Unvibe”…" progress (400x70; on the Intel runner it showed
  # for longer than 8 s in run 42181832386, so the real dialog came up only later).
  for i in $(seq 1 45); do
    read -r _ _ _ gw gh <<< "$("$W" find CoreServicesUIAgent || echo '0 0 0 0 0')"
    (( gh > 150 )) && break; sleep 2
  done
  r "Gatekeeper dialog ${gw}x${gh} after about $(( i * 2 )) s"
  prompts gatekeeper-1-double-click
  dr=$(t 15 osascript -e 'tell application "System Events" to tell process "CoreServicesUIAgent" to click button "Done" of window 1' 2>&1)
  sleep 2
  # unvibe-fix: prove the Done press landed (the lead's 7 Nov note: CI never checked it).
  read -r _ _ _ dw dh <<< "$("$W" find CoreServicesUIAgent || echo '0 0 0 0 0')"
  screencapture -x "$out/gatekeeper-1b-after-done.png"
  r "after Done: osascript said [${dr:-ok}]; Gatekeeper dialog still on screen: $( (( ${dh:-0} > 150 )) && echo "YES ${dw}x${dh}, the Done click did not land" || echo no)"
  r "after Done: Unvibe running: $([ -n "$(pgrep -x Unvibe)" ] && [[ $(ps -o stat= -p "$(pgrep -x Unvibe | head -1)") != *T* ]] && echo yes || echo no)"
  # The site's next step: System Settings > Privacy & Security > Open Anyway (picture of the pane as the user sees it).
  open "x-apple.systempreferences:com.apple.preference.security"; sleep 8
  S() { t 60 osascript "$here/settings.applescript" "$@" 2>&1 | tail -1; }
  S grow > /dev/null
  res=$(S anchor); sign=-1
  for i in $(seq 1 12); do
    read -r wid wx wy ww wh <<< "$("$W" find "System Settings" || echo '0 0 0 0 0')"
    [[ $res == found* ]] || break
    read -r _ ax ay aw ah <<< "$res"
    (( ay >= wy + 120 && ay <= wy + wh - 260 )) && break
    dist=$(( ay - wy - 180 )); ticks=$(( (dist < 0 ? -dist : dist) / 30 + 1 )); (( ticks > 40 )) && ticks=40
    "$W" scroll $(( wx + ww * 2 / 3 )) $(( wy + wh / 2 )) $(( dist > 0 ? 3 * sign : -3 * sign )) "$ticks"; sleep 1
    prev=$ay; res=$(S anchor)
    if [[ $res == found* ]]; then read -r _ _ ay2 _ _ <<< "$res"; if (( (dist > 0 && ay2 > prev) || (dist < 0 && ay2 < prev) )); then sign=$(( -sign )); fi; fi
  done
  read -r wid wx wy ww wh <<< "$("$W" find "System Settings" || echo '0 0 0 0 0')"
  [ "$wid" != 0 ] && screencapture -x -o -l "$wid" "$out/gatekeeper-2-privacy-security.png"
  r "Privacy & Security text naming Unvibe: $(S texts | tr '\n' ' ')"
  osascript -e 'tell application "System Settings" to quit' > /dev/null 2>&1
  # CI can't press Open Anyway and type a password (a synthetic click is ignored: runs 42149346752, 4bc8ae6).
  # Stand-in with the same result for the user (Gatekeeper lets this app open): the quarantine mark comes off.
  pkill -x Unvibe 2>/dev/null; xattr -dr com.apple.quarantine /Applications/Unvibe.app
  r "NOTE  stand-in for Open Anyway + password: quarantine removed on CI; everything after is the user's path"
  open /Applications/Unvibe.app
  ;;
dmgdirect)
  # unvibe-fix: the shortcut many people take: open Unvibe straight from the mounted disk image, no drag to Applications.
  asset="Unvibe-$V-mac-$([ "$arch" = arm64 ] && echo arm64 || echo x64).dmg"
  dmg="$HOME/Downloads/$asset"
  if [ -n "${DL_FILE:-}" ]; then
    asset=$(basename "$DL_FILE"); dmg="$HOME/Downloads/$asset"
    [ "$DL_FILE" -ef "$dmg" ] || ditto "$DL_FILE" "$dmg"
    q=$(xattr -p com.apple.quarantine "$dmg" 2>/dev/null)
    if [ -n "$q" ]; then how="the browser's own quarantine mark ($q)"
    else xattr -w com.apple.quarantine "0083;$(printf '%x' "$(date +%s)");Google Chrome;$(uuidgen)" "$dmg"; how="a quarantine mark ADDED (the browser saved none)"; fi
  else
    curl -fsSL -o "$dmg" "https://github.com/ShadowEsu/Unvibe/releases/download/v$V/$asset"
    xattr -w com.apple.quarantine "0083;$(printf '%x' "$(date +%s)");Safari;$(uuidgen)" "$dmg"
    how="a browser's quarantine mark"
  fi
  r "downloaded $asset ($(stat -f %z "$dmg") bytes) with $how"
  open "$dmg"
  vol=""; for i in $(seq 1 60); do vol=$(ls -d /Volumes/*/Unvibe.app 2>/dev/null | head -1); [ -n "$vol" ] && break; sleep 1; done
  [ -n "$vol" ] || { r "FAIL  install: the DMG did not mount"; prompts dmg-mount; exit 1; }
  r "quarantine on the app inside the mounted image: $(xattr -p com.apple.quarantine "$vol" 2>/dev/null || echo NONE)"
  r "spctl on the app inside the image: $(spctl --assess --type execute -vv "$vol" 2>&1 | tr '\n' ' ')"
  ( open "$vol" 2> "$out/open-direct.txt" ) &
  for i in $(seq 1 45); do
    read -r _ _ _ gw gh <<< "$("$W" find CoreServicesUIAgent || echo '0 0 0 0 0')"
    (( gh > 150 )) && break; sleep 2
  done
  r "direct open: Gatekeeper dialog ${gw}x${gh} after about $(( i * 2 )) s"
  prompts gatekeeper-direct
  sleep 3
  r "direct open: Unvibe running: $([ -n "$(pgrep -x Unvibe)" ] && echo "yes, from $(ps -o comm= -p "$(pgrep -x Unvibe | head -1)")" || echo no)"
  # The same Privacy & Security pane as the drag path, to see whether it offers Open Anyway for a copy on a disk image.
  t 15 osascript -e 'tell application "System Events" to tell process "CoreServicesUIAgent" to click button "Done" of window 1' > /dev/null 2>&1; sleep 2
  open "x-apple.systempreferences:com.apple.preference.security"; sleep 8
  S() { t 60 osascript "$here/settings.applescript" "$@" 2>&1 | tail -1; }
  S grow > /dev/null; S anchor > /dev/null
  read -r wid _ _ _ _ <<< "$("$W" find "System Settings" || echo '0 0 0 0 0')"
  [ "$wid" != 0 ] && screencapture -x -o -l "$wid" "$out/gatekeeper-direct-privacy-security.png"
  r "direct open, Privacy & Security text naming Unvibe: $(S texts | tr '\n' ' ')"
  osascript -e 'tell application "System Settings" to quit' > /dev/null 2>&1
  pkill -x Unvibe 2>/dev/null; hdiutil detach "$(dirname "$vol")" -force > /dev/null 2>&1
  r "NOTE  direct-from-image leg stops here: no launch, nothing to flag beyond the pre-flag"
  exit 0
  ;;
esac

# First launch: the app's window, any prompt it brings up, still running 20 s later.
sleep 15
pid=$(pgrep -x Unvibe | head -1)
prompts first-launch
uw=$(awk -F'\t' '$2=="Unvibe"' "$out/windows-first-launch.txt" | wc -l | tr -d ' ')
r "first launch: Unvibe pid ${pid:-NONE}, Unvibe windows on screen: $uw"
# The Automation consent ("“Unvibe” wants access to control “System Events”", Don't Allow / Allow; pictured above),
# answered Allow, the way most people do. Its buttons are pressed by position: Allow is the right one, 30 points up.
d=$("$W" find UserNotificationCenter || true)
if [ -n "$d" ]; then
  read -r _ px py pw ph <<< "$d"
  "$W" click $(( px + pw * 3 / 4 )) $(( py + ph - 30 )); sleep 2
  r "Automation consent: pressed Allow; still on screen after: $("$W" find UserNotificationCenter > /dev/null && echo yes || echo no)"
fi
sleep 5
alive=no; [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && alive=yes
if [ -n "$pid" ] && [ "$uw" -gt 0 ] && [ "$alive" = yes ]; then r "PASS  first launch: window shown, still running 20 s later"; else r "FAIL  first launch: pid=${pid:-none} windows=$uw alive=$alive"; fi
flag first-contact || r "FAIL  QA flag right after first contact"

# First explanation, on the same profile, through the app's debug port.
osascript -e 'tell application id "com.unvibe.app" to quit' > /dev/null 2>&1; sleep 3; pkill -x Unvibe 2>/dev/null; sleep 2
if [ "${NO_EXPLAIN:-}" = 1 ]; then
  # qa-first-open.yml while BOSS's AI pause is on: stop at first launch, no hosted-AI call.
  r "NOTE  first explanation skipped (NO_EXPLAIN=1: no hosted-AI call in this run)"
else
UNVIBE_EXE=/Applications/Unvibe.app/Contents/MacOS/Unvibe USER_DATA="$store_dir" OUT="$out" UNVIBE_OS=mac \
  NODE_PATH="$RUNNER_TEMP/pw/node_modules" t 420 node "$RUNNER_TEMP/pw/first-explain.mjs" > "$out/explain.log" 2>&1
r "first explanation (exit $?):"; sed 's/^/  /' "$out/explain-report.txt" 2>/dev/null | tee -a "$out/report.txt"
fi
pkill -x Unvibe 2>/dev/null
grep -q '^FAIL\|^  FAIL' "$out/report.txt" && exit 1
exit 0
