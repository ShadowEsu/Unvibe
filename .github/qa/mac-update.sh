#!/bin/bash
# QA PB-4 U-1 (ledger 591): a released FROM install on a clean Mac updates itself to the published TO the way a
# user's does: the app's own update check (GitHub releases API, drafts skipped) must offer TO, and the app's own
# install (download, SHA256SUMS check, helper script: codesign -R with the release pin + version, swap, reopen) must
# leave TO at /Applications, signed with the pin, its app.asar = WANT_ASAR, the profile (install id) kept, running.
# No hosted-AI call. Usage: mac-update.sh <out dir>
# Env: FROM (e.g. 0.1.50), TO (e.g. 0.1.51), WANT_ASAR, ARCH (arm64|x64), INSTALL_ID (qa-…), UNVIBE_QA_FLAG_TOKEN, RUNNER_TEMP
set +e -uo pipefail
out="$1"; mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"
W="$RUNNER_TEMP/gkwin"
r() { echo "$*" | tee -a "$out/report.txt"; }
t() { perl -e 'alarm shift @ARGV; exec @ARGV' "$@"; }
ud="$HOME/Library/Application Support/Unvibe"
APP=/Applications/Unvibe.app
PIN='identifier "com.unvibe.app" and certificate leaf = H"c9da4f618adf98911a450e041b8f336574a99d0e"'
ver() { /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist" 2>/dev/null; }
r "MAC UPDATE $FROM -> $TO on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m), DMG $ARCH"

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
# Any macOS question for Unvibe (System Events, from FROM's launch or the updated app's): pictured, answered Allow
# as most people do, so it can't hold anything else up. By position: Don't Allow left, Allow right, 30 points up.
answer_question() { # <label>
  local q wid px py pw ph
  q=$("$W" find UserNotificationCenter || true); [ -n "$q" ] || return 1
  "$W" list > "$out/windows-$1.txt"; screencapture -x "$out/$1-full-screen.png"
  read -r wid px py pw ph <<< "$q"
  screencapture -x -o -l "$wid" "$out/$1-question.png" 2>/dev/null
  "$W" click $(( px + pw * 3 / 4 )) $(( py + ph - 30 )); sleep 3
  r "  $1: a macOS question (UserNotificationCenter ${pw}x${ph}) pictured and answered Allow; still on screen: $("$W" find UserNotificationCenter > /dev/null && echo yes || echo no)"
}

# 1 The released FROM DMG, checked against its release's checksum, installed as a user ends up after Open Anyway.
dmg="$HOME/Downloads/Unvibe-$FROM-mac-$ARCH.dmg"
curl -fsSL -o "$dmg" "https://github.com/ShadowEsu/Unvibe/releases/download/v$FROM/Unvibe-$FROM-mac-$ARCH.dmg"
want=$(curl -fsSL "https://github.com/ShadowEsu/Unvibe/releases/download/v$FROM/SHA256SUMS-mac.txt" | awk -v a="Unvibe-$FROM-mac-$ARCH.dmg" '$2==a{print $1}')
got=$(shasum -a 256 "$dmg" | cut -d' ' -f1)
r "$FROM DMG sha256 $got; its SHA256SUMS-mac.txt $want; $([ "$got" = "$want" ] && echo match || echo MISMATCH)"
[ "$got" = "$want" ] || { r "FAIL  the $FROM DMG doesn't match its release checksum"; exit 1; }
mnt="$RUNNER_TEMP/mnt"; mkdir -p "$mnt"
hdiutil attach -nobrowse -readonly -mountpoint "$mnt" "$dmg" > /dev/null && ditto "$mnt/Unvibe.app" "$APP"; hdiutil detach "$mnt" -force > /dev/null 2>&1
xattr -cr "$APP"   # Gatekeeper's first-open steps are covered by qa-first-open.yml (stand-in for Open Anyway)
r "installed $(ver) at $APP"
[ "$(ver)" = "$FROM" ] || { r "FAIL  installed version is $(ver), not $FROM"; exit 1; }

# A set-up profile (onboarded) with a qa- install id, flagged before the first launch.
rm -rf "$ud"; mkdir -p "$ud"; printf '{"installId":"%s"}' "$INSTALL_ID" > "$ud/unvibe-store.json"
printf '{"onboarded":true,"theme":"light"}' > "$ud/unvibe-settings.json"
flag pre || { r "FAIL  QA pre-flag: not 200, so nothing is launched"; exit 1; }

# The app's update check is GitHub's unauthenticated API (60 an hour per IP; a runner shares its IP). The run needs
# about 3 calls, so with fewer than 6 left it waits for the reset (at most 30 min) before the app starts.
rl() { curl -s -m 15 https://api.github.com/rate_limit | python3 -c 'import json,sys; c=json.load(sys.stdin)["resources"]["core"]; print(c["remaining"], c["reset"])' 2>/dev/null; }
read -r left reset <<< "$(rl)"
r "GitHub API from this runner (unauthenticated): ${left:-?} calls left this hour, reset $(date -u -r "${reset:-0}" +%H:%M:%SZ 2>/dev/null)"
if [ -n "${left:-}" ] && [ "$left" -lt 6 ]; then
  wait_s=$(( reset - $(date +%s) + 5 )); (( wait_s > 1800 )) && wait_s=1800
  r "NOTE  waiting $wait_s s for the runner's GitHub API reset"; (( wait_s > 0 )) && sleep "$wait_s"
  read -r left reset <<< "$(rl)"; r "GitHub API now: ${left:-?} calls left"
fi

# 2 FROM, opened through LaunchServices with the debug port (the update path is the app's own, pressed through it).
open -a "$APP" --args --remote-debugging-port=9229
for i in $(seq 1 30); do answer_question "1-from-launch" && break; sleep 1; done
sleep 8
flag first-contact || r "FAIL  QA flag after first contact"

# 3 The app's own check, then its own install (mac-update.mjs prints "KEY value" lines).
cp "$here/mac-update.mjs" "$RUNNER_TEMP/pw/"
t0=$(date +%s)
t 900 node "$RUNNER_TEMP/pw/mac-update.mjs" "$out" "$TO" "$ARCH" > "$out/mac-update.log" 2>&1
cat "$out/mac-update.log" | tee -a "$out/report.txt"
grep -q '^PASS  update offered' "$out/mac-update.log" || { r "FAIL  $FROM did not offer $TO (see above)"; exit 1; }

# 4 The swap: TO at /Applications and running from there, within 4 minutes of the install press.
ok=""
for i in $(seq 1 240); do
  if [ "$(ver)" = "$TO" ] && pgrep -f "$APP/Contents/MacOS/Unvibe" > /dev/null; then ok=1; break; fi
  sleep 1
done
r "$([ -n "$ok" ] && echo PASS || echo FAIL)  $APP is $(ver) and running, $(( $(date +%s) - t0 )) s after the install press"
sleep 6; answer_question "2-to-launch" || r "NOTE  no macOS question at the updated app's first launch"
screencapture -x "$out/3-after-update-full-screen.png"
sleep 14
pgrep -f "$APP/Contents/MacOS/Unvibe" > /dev/null && r "PASS  the updated app is still running 20 s later" || r "FAIL  the updated app is not running 20 s later"
w=$("$W" find Unvibe || true); r "$([ -n "$w" ] && echo PASS || echo FAIL)  an Unvibe window is on screen (${w:-none})"

# 5 What the update left behind.
codesign --verify --deep --strict -R="$PIN" "$APP" > /dev/null 2>&1 && r "PASS  codesign --verify --deep --strict -R=<release pin c9da4f61> on the installed app" || r "FAIL  the installed app does not pass codesign -R=<release pin>"
r "  designated requirement: $(codesign -d -r- "$APP" 2>&1 | sed -n 's/^designated => //p')"
a=$(shasum -a 256 "$APP/Contents/Resources/app.asar" | cut -d' ' -f1)
r "$([ "$a" = "$WANT_ASAR" ] && echo PASS || echo FAIL)  installed app.asar sha256 $a (want ${WANT_ASAR:0:8}…)"
left=$(ls -d "$APP".old* "$APP".new 2>/dev/null | tr '\n' ' ')
r "$([ -z "$left" ] && echo PASS || echo FAIL)  no Unvibe.app.old / .new left behind${left:+: $left}"
q=$(xattr -p com.apple.quarantine "$APP" 2>/dev/null); r "NOTE  quarantine on the installed app: ${q:-none}"
id=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("installId",""))' "$ud/unvibe-store.json" 2>/dev/null)
r "$([ "$id" = "$INSTALL_ID" ] && echo PASS || echo FAIL)  the profile is kept: install id ${id:-none}"
flag after-update || r "FAIL  QA flag after the update"
grep -q '^FAIL' "$out/report.txt" && exit 1
exit 0
