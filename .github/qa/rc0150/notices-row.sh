#!/bin/bash
# RC-3 notice rows on a Mac: the DMG install and first launch (mac-row.sh dmg, as RC-1 item 3 / RC-2 row 2), then
# first-explain.mjs from qa/install-matrix as is, with NOTICES=1 (onboarding → the sample → the send agreement →
# N-0 a second real explanation via window.unvibe.explainClipboard() → N-1 silent → N-2 empty clipboard at once →
# N-3 amber → N-2c control 26 s later → N-4 #220 card '% AI used' → relaunch with live watch on a throwaway repo →
# N-5 grey info notice → N-6 a problem right after it, amber → N-7 nothing replaces the problem).
# Mac-only: a macOS privacy question can come up over the flow (Automation for System Events when a clipboard explain
# asks for the front app; the microphone question on Intel). first-explain's own watcher answers only the app's own
# dialogs, so a watcher here records every UserNotificationCenter question (time, words, picture) first, then answers
# it with its own button: the microphone question "Don't Allow" (Security RC3-5: the unhardened RC still asks), the
# System Events question "Allow" (as most people do). mac-row.sh's own position click at first launch is off
# (DIALOG_WATCHER=1), so only this watcher answers, after recording.
# Usage: notices-row.sh <out dir>     Env: DMG_DIR (the RC's DMGs), INSTALL_ID, UNVIBE_QA_FLAG_TOKEN
set +e -uo pipefail
out="$1"; mkdir -p "$out"
. "$(dirname "$0")/lib.sh"
ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time * 1000'; }

r "NOTICE ROWS on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m)"
r "first-explain.mjs: $(head -1 "$RUNNER_TEMP/pw/first-explain.source" 2>/dev/null) sha256 $(shasum -a 256 "$RUNNER_TEMP/pw/first-explain.mjs" | cut -d' ' -f1)"
build_rcmac || r "NOTE  helper did not build (dialogs pictured, not answered)"

(
  last=""; n=0
  while :; do
    d=$("$W" find UserNotificationCenter 2>/dev/null || true)
    if [ -n "$d" ] && [ "$d" != "$last" ]; then
      read -r id _ _ w h <<< "$d"
      if (( w > 150 )); then # past the grow animation
        n=$((n + 1)); pid=$(pgrep -x Unvibe | head -1)
        up=$([ -n "$pid" ] && ps -o etime= -p "$pid" | tr -d ' ' || echo "not running")
        screencapture -x "$out/notices-dialog-$n-full.png"; screencapture -x -o -l "$id" "$out/notices-dialog-$n.png"
        words=$(t 10 "$R" ax UserNotificationCenter 2>/dev/null | grep -E 'AXStaticText|AXButton' | sed 's/^ *//; s/ @ .*//' | tr '\n' ';')
        echo "$(date +%H:%M:%S) dialog #$n window $d; Unvibe pid ${pid:-none} running for $up; words: $words" >> "$out/dialog-watch.txt"
        if [[ $words == *"microphone"* ]]; then
          echo "$(date +%H:%M:%S) answered dialog #$n (microphone) Don't Allow: $(t 10 "$R" axpress UserNotificationCenter "Don't Allow" 2>&1 | tr '\n' ' ')" >> "$out/dialog-watch.txt"
        elif [[ $words == *"System Events"* ]]; then
          echo "$(date +%H:%M:%S) answered dialog #$n (System Events) Allow: $(t 10 "$R" axpress UserNotificationCenter Allow 2>&1 | tr '\n' ' ')" >> "$out/dialog-watch.txt"
        fi
        last=$d
      fi
    fi
    [ -z "$d" ] && last=""
    sleep 0.4
  done
) & watcher=$!
r "watcher started $(date +%H:%M:%S)"

NOTICES=1 EXPLAIN_T=900 DIALOG_WATCHER=1 bash "$(dirname "$0")/../mac-row.sh" dmg "$out"; rc=$?
kill "$watcher" 2>/dev/null
r "app bundle version: $(defaults read /Applications/Unvibe.app/Contents/Info.plist CFBundleShortVersionString)"
r "PRIVACY QUESTIONS seen by the watcher (recorded first, then answered with the button noted):"
if [ -s "$out/dialog-watch.txt" ]; then sed 's/^/  /' "$out/dialog-watch.txt" | tee -a "$out/report.txt"; else r "  none"; fi
r "TCC rows for com.unvibe.app at the end: $(utcc "SELECT service||' auth_value='||auth_value||' auth_reason='||auth_reason FROM access WHERE client='com.unvibe.app';" | tr '\n' ';')"
r "NOTICE LINES:"; grep -E '^(PASS|FAIL|NOTE)  (N-|N notice|info notice|card text|send agreement)' "$out/explain-report.txt" 2>/dev/null | sed 's/^/  /' | tee -a "$out/report.txt"
exit $rc
