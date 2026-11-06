#!/bin/bash
# Item 1, Design #206 on the 0.1.50 RC: a set-up profile (panel at its 420x460 minimum, one theme per job), macOS asks
# whether Unvibe may control System Events, Don't Allow is PRESSED (Escape, then an accessibility press of the button,
# then a click on it; a seeded deny row only if none of those answers it, and the report says so), the TCC row
# proves the answer, then Control+U in TextEdit and a still of the panel's denied note with its contrast measured.
# Usage: item1.sh <light|dark> <out dir>
set +e -uo pipefail
theme="$1"; out="$2"; mkdir -p "$out"
. "$(dirname "$0")/lib.sh"
P="1-206-$theme"
pass=1; fail() { r "FAIL  $*"; pass=0; }

r "ITEM 1 (#206) $theme on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m)"
build_rcmac || { r "FAIL  helper did not build"; exit 1; }
r "screen: $("$R" screen)"
seed_profile "$theme"
r "TCC Automation row (Unvibe → System Events) before launch: $(events_row || true)"
[ -z "$(events_row)" ] || fail "an Automation row existed before launch"
printf 'function selectedTotal(items) {\n  return items.reduce((sum, item) => sum + item.price * item.qty, 0);\n}\n' > "$RUNNER_TEMP/unvibe-sample.js"

launch
# A set-up profile starts the frontmost-app watch at launch, so macOS asks right away (selection.ts startFrontmostWatch).
d=""; for i in $(seq 1 60); do d=$("$W" find UserNotificationCenter || true); [ -n "$d" ] && break; sleep 0.5; done
[ -n "$d" ] || { fail "macOS's System Events question never appeared (30 s)"; "$W" list > "$out/windows-no-question.txt"; }
if [ -n "$d" ]; then
  read -r qid qx qy qw qh <<< "$d"
  r "question up after ~$(( i / 2 )) s: UserNotificationCenter window $qid ${qw}x${qh} at $qx,$qy"
  sleep 1
  screencapture -x "$out/$P-a-question-full.png"
  screencapture -x -o -l "$qid" "$out/$P-a-question-dialog.png"
  "$R" ax UserNotificationCenter > "$out/question-ax.txt" 2>&1
  r "question (accessibility text): $(grep -E 'AXStaticText|AXButton' "$out/question-ax.txt" | sed 's/^ *//; s/ @ .*//' | tr '\n' ';')"
fi

up() { "$W" find UserNotificationCenter > /dev/null; }
denied() { local k; for k in $(seq 1 10); do [[ $(events_row) == 0* ]] && return 0; sleep 0.5; done; return 1; }
method=""
attempt() { # <name> <command…>: one way of pressing Don't Allow, judged by the dialog closing AND the deny row
  local name="$1" k; shift
  [ -n "$method" ] && return
  for k in $(seq 1 10); do up && break; sleep 0.5; done # a dismissed question comes back with the watch's next poll
  up || { r "try $name: no dialog on screen to press"; return; }
  local said; said=$("$@" 2>&1 | tr '\n' ' '); sleep 2
  local closed=no; up || closed=yes
  if [ "$closed" = yes ] && denied; then method="real press: $name"; fi
  r "try $name: ${said:+$said; }dialog closed $closed, row: $(events_row || true)"
  "$W" list > "$out/windows-after-$(echo "$name" | tr -c 'a-zA-Z0-9\n' '-' | cut -c1-20).txt"
}
click_left() { local _i x y w h; read -r _i x y w h <<< "$("$W" find UserNotificationCenter)"; echo "click at $(( x + w / 4 )),$(( y + h - 30 ))"; "$W" click $(( x + w / 4 )) $(( y + h - 30 )); }
if [ -n "$d" ]; then
  # 1) Escape: Don't Allow is the alert's cancel button.
  attempt "Escape key (CGEvent, HID tap)" "$R" key 53
  # 2) An accessibility press of the "Don't Allow" button in UserNotificationCenter (no Apple Events involved).
  attempt "accessibility AXPress on UserNotificationCenter's \"Don't Allow\" button" "$R" axpress UserNotificationCenter "Don't Allow"
  # 3) A left click on the left button (Don't Allow; Allow is the right one, as mac-row.sh presses it).
  attempt "CGEvent click on the left (\"Don't Allow\") button" click_left
fi
if [ -z "$method" ]; then
  # 4) Nothing answered it: store what Don't Allow stores, and say so.
  utcc "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier_type,indirect_object_identifier,flags) VALUES('kTCCServiceAppleEvents','com.unvibe.app',0,0,2,1,0,'com.apple.systemevents',0);"
  killall -u "$USER" tccd 2>/dev/null; killall UserNotificationCenter 2>/dev/null; sleep 2
  method="SEEDED deny row (no press method answered the dialog on this runner)"
fi
r "DONT_ALLOW: $method"
r "TCC Automation row after the answer: $(events_row || true)"
[[ $(events_row) == 0* ]] || fail "no auth_value 0 row for com.unvibe.app → com.apple.systemevents"
screencapture -x "$out/$P-b-after-dont-allow-full.png"

flag first-contact || fail "QA flag after first contact"

# The runner's own keystrokes go through System Events (allowed for osascript by gk-setup.sh).
ok=no; for i in $(seq 1 15); do t 10 osascript -e 'tell application "System Events" to get name of first process' > /dev/null 2>&1 && { ok=yes; break; }; sleep 2; done
r "System Events answers the runner: $ok"
open -a TextEdit "$RUNNER_TEMP/unvibe-sample.js"; sleep 3
t 15 osascript -e 'tell application "TextEdit" to activate' -e 'delay 1' -e 'tell application "System Events" to keystroke "a" using command down'
sleep 1
t 15 osascript -e 'tell application "System Events" to keystroke "u" using control down'
r "pressed Control+U in TextEdit with the sample selected"
sleep 3
NOTE_WAIT=15000 PANEL="$theme" t 90 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" note206 "$out" "$P" > "$out/cdp-note.txt" 2>&1
if grep -q '^ERROR' "$out/cdp-note.txt"; then
  r "no denied note after Control+U ($(grep '^ERROR' "$out/cdp-note.txt")); the same capture through unvibe://review"
  open 'unvibe://review'; sleep 3
  NOTE_WAIT=15000 PANEL="$theme" t 90 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" note206 "$out" "$P" > "$out/cdp-note.txt" 2>&1
  r "TRIGGER unvibe://review (Control+U showed no note)"
else
  r "TRIGGER Control+U"
fi
sed 's/^/  cdp: /' "$out/cdp-note.txt" | tee -a "$out/report.txt"
v() { grep "^$1 " "$out/cdp-note.txt" | head -1 | cut -d' ' -f2-; }
sleep 1
"$W" list > "$out/windows-at-still.txt"
over=$("$W" find UserNotificationCenter || true)
screencapture -x "$out/$P-c-denied-note-full.png"
read -r px py pw ph _ <<< "$(v PANEL_WINDOW)"
[ -n "${pw:-}" ] && screencapture -x -R "$px,$py,$pw,$ph" "$out/$P-c-denied-note-panel.png"
r "panel window: $(v PANEL_WINDOW); note rect in panel: $(v NOTE_RECT); clipped by: $(v NOTE_CLIPPED_BY); text + button all visible: $(v NOTE_CONTENT_VISIBLE)"
r "System Events dialog on screen at the still: $([ -n "$over" ] && echo "YES ($over)" || echo no)"
text=$(v NOTE_TEXT)
[[ $text == *"macOS is blocking Unvibe from copying your selection"*"turn on System Events under Unvibe"* ]] || fail "denied note text: ${text:-none}"
[[ $(v NOTE_BUTTONS) == *"Open Automation settings"* ]] || fail "no Open Automation settings button"
[[ $(v THEME) == "panel=$theme "* ]] || fail "panel look is $(v THEME), not $theme"
[[ $(v NOTE_CONTENT_VISIBLE) == yes* ]] || fail "the note's text or button is cut off as the panel opens: $(v NOTE_CONTENT_VISIBLE)"
[ "$(v NOTE_CLIPPED_BY)" = nothing ] || r "FINDING  at 420x460 the note's box runs past the panel's scroll area ($(v NOTE_CLIPPED_BY)): $(v NOTE_CONTENT_VISIBLE)"
[ -z "$over" ] || fail "the System Events dialog covers the still"
[ "${pw:-0}" = 420 ] && [ "${ph:-0}" = 460 ] || r "NOTE  panel is ${pw:-?}x${ph:-?}, not 420x460"
# The same note scrolled fully into view (as a person scrolls the panel), for the full box including its border.
SCROLL=1 t 60 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" note206 "$out" "$P-scrolled" > "$out/cdp-note-scrolled.txt" 2>&1
sed 's/^/  cdp scrolled: /' "$out/cdp-note-scrolled.txt" | tee -a "$out/report.txt"
sleep 0.5
[ -n "${pw:-}" ] && screencapture -x -R "$px,$py,$pw,$ph" "$out/$P-d-denied-note-scrolled-panel.png"
screencapture -x "$out/$P-d-denied-note-scrolled-full.png"
r "scrolled: clipped by $(grep '^NOTE_CLIPPED_BY ' "$out/cdp-note-scrolled.txt" | cut -d' ' -f2-); dialog on screen: $("$W" find UserNotificationCenter > /dev/null && echo YES || echo no)"
tc=$(v CONTRAST_TEXT | sed -E 's/.*= ([0-9.]+):1/\1/'); bc=$(v CONTRAST_BORDER | sed -E 's/.*= ([0-9.]+):1/\1/')
r "CONTRAST note text: $(v CONTRAST_TEXT) (needs >= 4.5): $(awk -v x="${tc:-0}" 'BEGIN{print (x>=4.5)?"PASS":"FAIL"}')"
r "CONTRAST note border vs panel: $(v CONTRAST_BORDER) (needs >= 3): $(awk -v x="${bc:-0}" 'BEGIN{print (x>=3)?"PASS":"FAIL"}')"
awk -v x="${tc:-0}" 'BEGIN{exit !(x>=4.5)}' || fail "text contrast ${tc:-none} < 4.5"
awk -v x="${bc:-0}" 'BEGIN{exit !(x>=3)}' || fail "border contrast ${bc:-none} < 3"
quit_app
r "settings after: $(grep -o '"theme":"[a-z]*"\|"lastWidgetBounds":{[^}]*}' "$ud/unvibe-settings.json" | tr '\n' ' ')"
if [ "$pass" = 1 ]; then r "PASS  item 1 #206 $theme (Don't Allow: $method)"; else r "FAIL  item 1 #206 $theme"; exit 1; fi
