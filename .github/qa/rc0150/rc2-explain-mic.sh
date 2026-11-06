#!/bin/bash
# RC-2 rows 2 + 3: the DMG install and first explanation (mac-row.sh dmg, as RC-1 item 3), while a watcher records
# every system dialog from before the install to the end of onboarding: when it showed, how long Unvibe had been
# running, its words, and a picture (the microphone question on Intel in RC-1). The runner's audio devices come first.
# Usage: rc2-explain-mic.sh <out dir> [input]   input: add a virtual microphone (BlackHole 2ch) before installing,
#        to see whether an arm64 runner asks once it has an input device.
set +e -uo pipefail
out="$1"; mode="${2:-plain}"; mkdir -p "$out"
. "$(dirname "$0")/lib.sh"
P="rc2-$(uname -m)-$mode"

r "RC-2 ROWS 2+3 on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m), mode $mode"
build_rcmac || r "NOTE  helper did not build (dialog words from pictures only)"
if [ "$mode" = input ]; then
  t 600 brew install --cask blackhole-2ch > "$out/blackhole-install.txt" 2>&1; r "BlackHole 2ch install exit $?: $(tail -1 "$out/blackhole-install.txt")"
  sudo killall coreaudiod 2>/dev/null; sleep 8
fi
system_profiler SPAudioDataType > "$out/audio-devices.txt" 2>&1
system_profiler -json SPAudioDataType > "$out/audio-devices.json" 2>/dev/null
inputs=$(python3 -c '
import json, sys
items = (json.load(open(sys.argv[1])).get("SPAudioDataType") or [{}])[0].get("_items", [])
ins = ["%s (%s input ch%s)" % (d.get("_name"), d.get("coreaudio_device_input"), ", default input" if d.get("coreaudio_default_audio_input_device") else "") for d in items if d.get("coreaudio_device_input")]
print("; ".join(ins) if ins else "NONE")
print("all devices: " + "; ".join(d.get("_name", "?") for d in items), file=sys.stderr)
' "$out/audio-devices.json" 2>> "$out/report.txt")
r "AUDIO INPUT DEVICES: $inputs"

# The watcher: every new on-screen UserNotificationCenter window (where macOS asks for privacy access).
(
  last=""; n=0
  while :; do
    d=$("$W" find UserNotificationCenter 2>/dev/null || true)
    if [ -n "$d" ] && [ "$d" != "$last" ]; then
      read -r id _ _ w h <<< "$d"
      if (( w > 150 )); then # past the grow animation
        n=$((n + 1)); pid=$(pgrep -x Unvibe | head -1)
        up=$([ -n "$pid" ] && ps -o etime= -p "$pid" | tr -d ' ' || echo "not running")
        screencapture -x "$out/$P-dialog-$n-full.png"; screencapture -x -o -l "$id" "$out/$P-dialog-$n.png"
        words=$(t 10 "$R" ax UserNotificationCenter 2>/dev/null | grep -E 'AXStaticText|AXButton' | sed 's/^ *//; s/ @ .*//' | tr '\n' ';')
        echo "$(date +%H:%M:%S) dialog #$n window $d; Unvibe pid ${pid:-none} running for $up; words: $words" >> "$out/dialog-watch.txt"
        last=$d
      fi
    fi
    [ -z "$d" ] && last=""
    sleep 0.4
  done
) & watcher=$!
r "watcher started $(date +%H:%M:%S)"

V=0.1.50 bash "$(dirname "$0")/../mac-row.sh" dmg "$out"; rc=$?
kill "$watcher" 2>/dev/null
r "app bundle version: $(defaults read /Applications/Unvibe.app/Contents/Info.plist CFBundleShortVersionString)"
r "DIALOGS seen by the watcher (mac-row timeline: dmg open, Gatekeeper, first launch at +15 s, then first-explain's onboarding):"
if [ -s "$out/dialog-watch.txt" ]; then sed 's/^/  /' "$out/dialog-watch.txt" | tee -a "$out/report.txt"; else r "  none"; fi
mic=$(grep -c 'access the microphone' "$out/dialog-watch.txt" 2>/dev/null); mic=${mic:-0}
r "MIC question shown: $([ "$mic" -gt 0 ] && echo "YES ($mic time(s))" || echo no)"
r "TCC microphone row for Unvibe: $(utcc "SELECT 'auth_value='||auth_value||' auth_reason='||auth_reason||' at '||datetime(last_modified,'unixepoch') FROM access WHERE service='kTCCServiceMicrophone' AND client='com.unvibe.app';" || true)"
r "mac-row: $(grep -E '^(PASS|FAIL)|PASS  a complete|companion window opens' "$out/report.txt" | tr '\n' ' ' | cut -c1-400)"
exit $rc
