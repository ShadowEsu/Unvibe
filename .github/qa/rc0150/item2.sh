#!/bin/bash
# Item 2, Design #213 + #218 on the 0.1.50 RC (Mac): a notice under the Island ("Your clipboard is empty…" from an
# IDE-link clipboard explain with nothing copied, main.ts), stills at ~1 s and ~5 s, then every 250 ms from 8 s to
# 10.5 s across the 9 s exit, with the Island window's bounds per frame (CGWindowList) against the screen's visible
# frame. Then a click on the Island while a notice shows, and the expanded card's .island__note (#218: #ededed).
# Usage: item2.sh <out dir>
set +e -uo pipefail
out="$1"; mkdir -p "$out"
. "$(dirname "$0")/lib.sh"
P="2-213-island"
pass=1; fail() { r "FAIL  $*"; pass=0; }
cdp() { t 60 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" "$@"; }

r "ITEM 2 (#213 + #218) on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m)"
build_rcmac || { r "FAIL  helper did not build"; exit 1; }
scr=$("$R" screen); r "SCREEN $scr"
read -r _ fx fy fw fh _ vx vy vw vh _ scale _ <<< "$scr"
seed_profile dark
# A set-up profile asks macOS about System Events at launch; this item is about the Island, so the profile is one that
# already answered Allow (the row Allow stores), and no question covers the Island.
utcc "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier_type,indirect_object_identifier,flags) VALUES('kTCCServiceAppleEvents','com.unvibe.app',0,2,2,1,0,'com.apple.systemevents',0);"
killall -u "$USER" tccd 2>/dev/null
r "seeded Automation Allow (Unvibe → System Events): $(events_row || true)"

launch
sleep 10
flag first-contact || fail "QA flag after first contact"
cdp island "$out" "$P-0-before" > "$out/cdp-before.txt" 2>&1
sed 's/^/  cdp before: /' "$out/cdp-before.txt" | tee -a "$out/report.txt"
read -r bx by bw bh _ <<< "$(grep '^BAR_WINDOW ' "$out/cdp-before.txt" | cut -d' ' -f2-)"
num=$("$R" winfor Unvibe "${bx:-0}" "${by:-0}" "${bw:-0}")
[ -n "$num" ] || { fail "no on-screen Unvibe window at the Island's position ${bx:-?},${by:-?} width ${bw:-?}"; "$W" list > "$out/windows-before.txt"; }
r "Island window $num before the notice: $("$R" bounds "${num:-0}") (x y w h, points); class: $(grep '^ISLAND_CLASS ' "$out/cdp-before.txt" | cut -d' ' -f2-)"
read -r _ _ _ h0 <<< "$("$R" bounds "${num:-0}")"
placement=$([[ $(grep '^ISLAND_CLASS ' "$out/cdp-before.txt") == *island--attached* ]] && echo "attached to the top screen edge (top-center Mac Island)" || echo "floating pill")
r "PLACEMENT $placement; screen notch: $(echo "$scr" | grep -o 'safeAreaInsets.*')"
screencapture -x "$out/$P-0-before-full.png"

# The notice: nothing on the clipboard, then the IDE link (prefers the clipboard).
pbcopy < /dev/null
r "clipboard bytes before the link: $(pbpaste | wc -c | tr -d ' ')"
region="$(( bx - 120 )),0,$(( bw + 240 )),$(( h0 + 64 + 40 ))"
plan="1,5,8,8.25,8.5,8.75,9,9.25,9.5,9.75,10,10.25,10.5"
"$R" timeline "${num:-0}" "${h0:-38}" "$out" "$P-1" "$region" "$plan" > "$out/timeline.csv" 2>&1 &
tl=$!
sleep 0.3
open 'unvibe://review?source=ide'
( sleep 2.5; cdp island "$out" "$P-1-notice" > "$out/cdp-notice.txt" 2>&1 ) &
( sleep 1.5; screencapture -x "$out/$P-1-notice-full-1s.png"; sleep 3.5; screencapture -x "$out/$P-1-notice-full-5s.png" ) &
wait $tl
wait
r "TIMELINE (planned s, ms after t0, x, y, w, h, frame file) region $region:"
sed 's/^/  /' "$out/timeline.csv" | tee -a "$out/report.txt"
sed 's/^/  cdp notice: /' "$out/cdp-notice.txt" | tee -a "$out/report.txt"
notice=$(grep '^NOTICE ' "$out/cdp-notice.txt" | cut -d' ' -f2-)
[[ $notice == *"Your clipboard is empty. Copy some code first, then try again."* ]] || fail "notice text: ${notice:-none}"

# Numbers: inside the visible frame, and no move of the pill (x, y, width) between frames.
awk -F, -v vx="$vx" -v vy="$vy" -v vw="$vw" -v vh="$vh" -v h0="$h0" '
  /^[0-9]/ && $3 != "gone" { n++; x[n]=$3; y[n]=$4; w[n]=$5; h[n]=$6; s[n]=$1
    win = ($3 >= vx && $4 >= vy && $3 + $5 <= vx + vw && $4 + $6 <= vy + vh) ? "yes" : "no"
    noticeIn = ($4 + h0 >= vy && $4 + $6 <= vy + vh && $3 >= vx && $3 + $5 <= vx + vw) ? "yes" : "no"
    printf "  frame %ss: window %d,%d %dx%d; whole window inside visible frame: %s; notice part (y %d..%d) inside: %s\n", $1, $3, $4, $5, $6, win, $4 + h0, $4 + $6, noticeIn }
  END { moved = 0; for (i = 2; i <= n; i++) if (x[i] != x[1] || y[i] != y[1]) moved++
    grown = 0; shrunk = 0; for (i = 1; i <= n; i++) { if (h[i] > h0) grown++; else shrunk++ }
    printf "PILL_MOVES %d (frames whose window origin differs from the first; the top-attached pill sits at the window top)\n", moved
    printf "FRAMES grown %d, back to %d px %d; last grown frame and first compact frame bracket the exit\n", grown, h0, shrunk }' "$out/timeline.csv" | tee -a "$out/report.txt"
grep -q '^PILL_MOVES 0' "$out/report.txt" || fail "the Island window origin moved between frames"
grep -q '^1\.0,' "$out/timeline.csv" || fail "no timeline frames (no notice growth seen)"

# #218: a click on the Island while a notice shows opens the card; its .island__note is neutral.
sleep 8 # the 15 s notify rate limit since the first notice
pbcopy < /dev/null
"$R" waitgrow "${num:-0}" "${h0:-38}" 20 > "$out/waitgrow.txt" &
wg=$!
sleep 0.3; open 'unvibe://review?source=ide'
wait $wg && r "second notice up (grew after $(cat "$out/waitgrow.txt") ms)" || fail "second notice did not show"
sleep 1
read -r gx gy gw gh <<< "$("$R" bounds "${num:-0}")"
cx=$(( gx + gw / 2 )); cy=$(( gy + h0 + 32 ))
"$W" click "$cx" "$cy"
r "clicked the notice at $cx,$cy (window $gx,$gy ${gw}x${gh})"
sleep 1.2
read -r ex ey ew eh <<< "$("$R" bounds "${num:-0}")"
r "after the click: window $ex,$ey ${ew}x${eh}"
screencapture -x -R "$(( ex - 20 )),0,$(( ew + 40 )),$(( ey + eh + 20 ))" "$out/$P-2-218-expanded-note.png"
screencapture -x "$out/$P-2-218-expanded-note-full.png"
cdp islandnote "$out" "$P-2-218" > "$out/cdp-218.txt" 2>&1
sed 's/^/  cdp #218: /' "$out/cdp-218.txt" | tee -a "$out/report.txt"
note=$(grep '^NOTE ' "$out/cdp-218.txt" | cut -d' ' -f2-)
[[ $(grep '^ISLAND_CLASS ' "$out/cdp-218.txt") == *island--expanded* ]] || fail "the click did not expand the Island"
[[ $note == *"colour #ededed"* ]] || fail "#218 .island__note colour: ${note:-none}"
"$W" list > "$out/windows-end.txt"
quit_app
if [ "$pass" = 1 ]; then r "PASS  item 2 #213 + #218"; else r "FAIL  item 2 #213 + #218"; exit 1; fi
