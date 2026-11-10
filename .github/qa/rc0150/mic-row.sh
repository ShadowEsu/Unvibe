#!/bin/bash
# Mic rows (the microphone question on macos-15-intel): a fresh install of one DMG, a fresh profile (the store holds
# only the qa- install id; with `soundoff`, unvibe-settings.json also holds {"soundEffects":false}), then:
#   phase 1  `open /Applications/Unvibe.app` (as the RC-2 Intel row launched it) and nothing pressed for 75 s on
#            onboarding step 1;
#   phase 2  quit, start again through LaunchServices with a debug port, then PHASE2 (env, cdp.mjs mode): `onboard`
#            (default) = onboarding step 1 → 2 → the sample's explanation (driven like first-explain.mjs); `finish` =
#            setup finished by clicks with no explanation (no hosted-AI call; T-1, MUST-H1); then 30 s more.
# A watcher records every UserNotificationCenter window throughout: seconds after the launch, its words, pictures.
# The microphone question is never answered. A System Events question (0.1.49 asks at launch, F-02) is answered
# Allow, as most people do, so it can't hold the microphone question back.
# Re-sign (Security H-1/H-2), after the copy to /Applications and before any launch:
#   runtime    ad-hoc as a publish run signs: --deep, ENTITLEMENTS (main's app/build/entitlements.mac.plist), --options runtime
#   noruntime  plain ad-hoc: --deep, no entitlements, no hardened runtime
# Usage: mic-row.sh <out dir> <dmg> <label> [default|soundoff] [none|runtime|noruntime]
set +e -uo pipefail
out="$1"; dmg="$2"; label="$3"; sounds="${4:-default}"; resign="${5:-none}"; mkdir -p "$out"
. "$(dirname "$0")/lib.sh"
ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time * 1000'; }

r "MIC ROW $label on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m); sounds: $sounds"
build_rcmac || r "NOTE  helper did not build (dialog words from pictures only)"
system_profiler SPAudioDataType > "$out/audio-devices.txt" 2>&1
r "audio devices: $(grep -E '^        [^ ].*:$|Input Channels|Default Input' "$out/audio-devices.txt" | sed 's/^ *//' | tr '\n' ' ')"

mnt="$RUNNER_TEMP/mnt"; mkdir -p "$mnt"
hdiutil attach -nobrowse -readonly -mountpoint "$mnt" "$dmg" > /dev/null
ditto "$mnt/Unvibe.app" /Applications/Unvibe.app; hdiutil detach "$mnt" -force > /dev/null
xattr -cr /Applications/Unvibe.app
r "installed $(defaults read /Applications/Unvibe.app/Contents/Info.plist CFBundleShortVersionString) from $(basename "$dmg") (sha256 $(shasum -a 256 "$dmg" | cut -d' ' -f1)); quarantine removed (the Gatekeeper path is RC-1/RC-2 row 3's)"
asar=$(shasum -a 256 /Applications/Unvibe.app/Contents/Resources/app.asar | cut -d' ' -f1)
if [ -n "${WANT_ASAR_PREFIX:-}" ]; then r "$([[ "$asar" == "$WANT_ASAR_PREFIX"* ]] && echo PASS || echo FAIL)  installed app.asar sha256 $asar (Security's baseline $WANT_ASAR_PREFIX…)"
else r "installed app.asar sha256 $asar"; fi
sig() { # <tag>: the signature as it stands, into files and the report
  codesign -dv --verbose=4 /Applications/Unvibe.app > "$out/codesign-$1.txt" 2>&1
  codesign -d --entitlements :- /Applications/Unvibe.app > "$out/entitlements-$1.plist" 2> "$out/entitlements-$1.err"
  r "signature ($1): $(grep -E '^(Signature|flags|CodeDirectory|TeamIdentifier|Authority)' "$out/codesign-$1.txt" | tr '\n' ' ')"
  r "entitlements ($1): $(grep -o '<key>[^<]*</key>' "$out/entitlements-$1.plist" | sed 's/<[^>]*>//g' | tr '\n' ' ' || true)$( [ -s "$out/entitlements-$1.plist" ] || echo none)"
}
sig as-shipped
if [ "$resign" = runtime ]; then
  codesign --force --deep --sign - --entitlements "$ENTITLEMENTS" --options runtime /Applications/Unvibe.app > "$out/resign.txt" 2>&1
  r "RE-SIGNED ad-hoc with hardened runtime + $ENTITLEMENTS (sha256 $(shasum -a 256 "$ENTITLEMENTS" | cut -d' ' -f1)): exit $?; $(tail -2 "$out/resign.txt" | tr '\n' ' ')"
elif [ "$resign" = noruntime ]; then
  codesign --force --deep --sign - /Applications/Unvibe.app > "$out/resign.txt" 2>&1
  r "RE-SIGNED ad-hoc WITHOUT hardened runtime and WITHOUT entitlements: exit $?; $(tail -2 "$out/resign.txt" | tr '\n' ' ')"
fi
if [ "$resign" != none ]; then
  xattr -cr /Applications/Unvibe.app
  sig resigned
  r "codesign --verify --deep --strict: $(codesign --verify --deep --strict -v /Applications/Unvibe.app 2>&1 | tr '\n' ' ')"
fi

rm -rf "$ud"; mkdir -p "$ud"
printf '{"installId":"%s"}' "$INSTALL_ID" > "$ud/unvibe-store.json"
[ "$sounds" = soundoff ] && printf '{"soundEffects":false}' > "$ud/unvibe-settings.json"
r "fresh profile: store $(cat "$ud/unvibe-store.json"); settings $(cat "$ud/unvibe-settings.json" 2>/dev/null || echo '(none)')"
tccrows() { sqlite3 -readonly "$udb" "SELECT service||COALESCE(' -> '||indirect_object_identifier,'')||' auth_value='||auth_value||' auth_reason='||auth_reason||' at '||datetime(last_modified,'unixepoch') FROM access WHERE client='com.unvibe.app';" 2>/dev/null || sudo sqlite3 -readonly "$udb" "SELECT service||COALESCE(' -> '||indirect_object_identifier,'')||' auth_value='||auth_value||' auth_reason='||auth_reason||' at '||datetime(last_modified,'unixepoch') FROM access WHERE client='com.unvibe.app';"; }
r "TCC rows for com.unvibe.app before launch: $(tccrows | tr '\n' ';')"

# The watcher. Launch times (epoch ms) are appended to $out/launches as "<ms> <phase>".
: > "$out/launches"
(
  last=""; n=0
  while :; do
    d=$("$W" find UserNotificationCenter 2>/dev/null || true)
    if [ -n "$d" ] && [ "$d" != "$last" ]; then
      read -r id _ _ w _ <<< "$d"
      if (( w > 150 )); then # past the grow animation
        n=$((n + 1)); now=$(ms); read -r l0 phase <<< "$(tail -1 "$out/launches")"
        screencapture -x "$out/$label-dialog-$n-full.png"; screencapture -x -o -l "$id" "$out/$label-dialog-$n.png"
        words=$(t 10 "$R" ax UserNotificationCenter 2>/dev/null | grep -E 'AXStaticText|AXButton' | sed 's/^ *//; s/ @ .*//' | tr '\n' ';')
        echo "$now dialog #$n at +$(( (now - ${l0:-now}) / 1000 )).$(( (now - ${l0:-now}) % 1000 / 100 )) s after the $phase launch; window $d; words: $words" >> "$out/dialog-watch.txt"
        if [[ $words == *"System Events"* ]]; then
          echo "$(ms) answered the System Events question: $(t 10 "$R" axpress UserNotificationCenter Allow 2>&1 | tr '\n' ' ')" >> "$out/dialog-watch.txt"
        fi
        last=$d
      fi
    fi
    [ -z "$d" ] && last=""
    sleep 0.3
  done
) & watcher=$!

# Phase 1: launched as the RC-2 row did, nothing pressed.
echo "$(ms) phase-1" >> "$out/launches"
open /Applications/Unvibe.app
r "phase 1: open /Applications/Unvibe.app at $(date +%H:%M:%S); nothing is pressed for 75 s"
for s in 5 15 30 60 75; do
  sleep $(( s == 5 ? 5 : s == 15 ? 10 : s == 30 ? 15 : s == 60 ? 30 : 15 ))
  screencapture -x "$out/$label-phase1-${s}s-full.png"
  [ $s = 15 ] && { flag first-contact || r "FAIL  QA flag after first contact"; }
done
r "phase 1 windows at 75 s: $("$W" list | awk -F'\t' '$2=="Unvibe"||$2=="UserNotificationCenter"' | tr '\t\n' ' ;')"
r "TCC rows after phase 1: $(tccrows | tr '\n' ';')"

# Phase 2: the same install and profile, onboarding and the sample explanation.
pkill -x Unvibe; sleep 3
echo "$(ms) phase-2" >> "$out/launches"
open -a /Applications/Unvibe.app --args --remote-debugging-port=0
r "phase 2: open -a … --args --remote-debugging-port=0 at $(date +%H:%M:%S)"
t 300 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" "${PHASE2:-onboard}" "$out" "$label-${PHASE2:-onboard}" > "$out/onboard.txt" 2>&1
sed 's/^/  cdp: /' "$out/onboard.txt" | tee -a "$out/report.txt"
screencapture -x "$out/$label-phase2-explanation-full.png"
sleep 30
screencapture -x "$out/$label-phase2-end-full.png"
kill "$watcher" 2>/dev/null
pkill -x Unvibe

# Every dialog, placed on the screen it came up over.
r "DIALOGS (seconds after that phase's launch):"
if [ -s "$out/dialog-watch.txt" ]; then sed 's/^/  /' "$out/dialog-watch.txt" | tee -a "$out/report.txt"; else r "  none"; fi
p2=$(grep phase-2 "$out/launches" | cut -d' ' -f1)
grep '^SCREEN ' "$out/onboard.txt" | while read -r _ at what; do r "  phase 2 screen at +$(( (at - p2) / 1000 )) s: $what"; done
mic=$(grep -c 'access the microphone' "$out/dialog-watch.txt" 2>/dev/null); mic=${mic:-0}
r "MIC question: $([ "$mic" -gt 0 ] && echo "YES ($mic)" || echo no)"
r "TCC rows for com.unvibe.app at the end (user TCC.db, read-only): $(tccrows | tr '\n' ';')"
r "version: $(defaults read /Applications/Unvibe.app/Contents/Info.plist CFBundleShortVersionString); $(grep -E '^(VERSION|EXPLANATION|ERROR) ' "$out/onboard.txt" | tr '\n' ' ')"
# T-1 (MUST-H1): when the System Events question came, by phase; in phase 2 also against the setup-finished press.
fin=$(sed -n 's/^SCREEN \([0-9]*\) setup finished.*/\1/p' "$out/onboard.txt" | head -1)
se=0
while read -r at _; do
  se=$((se + 1))
  if [ "$at" -lt "${p2:-0}" ]; then r "T-1 System Events question #$se: phase 1 (first open, nothing pressed)"
  elif [ -n "$fin" ]; then d=$(( at - fin )); r "T-1 System Events question #$se: phase 2, $( (( d < 0 )) && echo "$(( -d )) ms BEFORE" || echo "$d ms after") the setup-finished press"
  else r "T-1 System Events question #$se: phase 2 (no setup-finished mark)"; fi
done < <(grep -E '^[0-9]+ dialog #' "$out/dialog-watch.txt" 2>/dev/null | grep 'System Events')
r "T-1 System Events questions in all: $se"
