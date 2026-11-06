#!/bin/bash
# RC-2 row 1, Island compact parity (Design #213 / #219): a set-up profile, the Island in its default place. The
# COMPACT Island (no notice) is cropped from the screen at its count, enlarged 4x nearest-neighbour, and the gap from
# the </> chip to the count's first character is read from bar.html. Then the onboarding sample's real explanation,
# ~3 s, and the same at the new count. Nothing in the page is changed; the app is only read.
# Usage: rc2-row1.sh <out dir>
set +e -uo pipefail
out="$1"; mkdir -p "$out"
. "$(dirname "$0")/lib.sh"
P="rc2-1-island"
pass=1; fail() { r "FAIL  $*"; pass=0; }
cdp() { t 200 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" "$@"; }

r "RC-2 ROW 1 (#213/#219 compact Island) on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m)"
build_rcmac || { r "FAIL  helper did not build"; exit 1; }
r "SCREEN $("$R" screen)"
seed_profile dark
# Allow (what Allow stores) for Unvibe → System Events, so the launch question doesn't cover the screen.
utcc "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier_type,indirect_object_identifier,flags) VALUES('kTCCServiceAppleEvents','com.unvibe.app',0,2,2,1,0,'com.apple.systemevents',0);"
killall -u "$USER" tccd 2>/dev/null
r "seeded Automation Allow (Unvibe → System Events): $(events_row || true)"
"$R" move 980 700 # the pointer away from the Island (no hover)
launch
sleep 10
flag first-contact || fail "QA flag after first contact"

shot() { # <tag>: compact Island state from bar.html, then the crop of its window, then the 4x enlargement
  local tag="$1" txt bx by bw bh
  cdp islandcount "$out" "$P-$tag" > "$out/cdp-$tag.txt" 2>&1
  sed "s/^/  cdp $tag: /" "$out/cdp-$tag.txt" | tee -a "$out/report.txt"
  read -r bx by bw bh _ <<< "$(grep '^BAR_WINDOW ' "$out/cdp-$tag.txt" | cut -d' ' -f2-)"
  local num; num=$("$R" winfor Unvibe "${bx:-0}" "${by:-0}" "${bw:-0}")
  r "  Island window ${num:-NONE}: $("$R" bounds "${num:-0}" 2>/dev/null || echo none) (CGWindowList x y w h)"
  "$W" find UserNotificationCenter > /dev/null && r "  NOTE a system dialog is on screen at this crop"
  screencapture -x -R "$bx,$by,$bw,$bh" "$out/$P-$tag-crop-1x.png"
  r "  4x: $("$R" enlarge "$out/$P-$tag-crop-1x.png" "$out/$P-$tag-crop-4x.png" 4 | tr '\n' ' ')"
  screencapture -x "$out/$P-$tag-full.png"
  txt=$(grep '^COUNT_TEXT ' "$out/cdp-$tag.txt" | cut -d' ' -f2-)
  gap=$(grep '^GAP ' "$out/cdp-$tag.txt" | awk '{print $2}')
  r "COUNT $tag: $txt; gap chip→first character $gap px; $(grep '^ISLAND_CLASS ' "$out/cdp-$tag.txt" | cut -d' ' -f2-)"
  [[ $(grep '^ISLAND_CLASS ' "$out/cdp-$tag.txt") == *"compact reached: yes"* ]] || fail "$tag: the Island never showed its compact count"
  awk -v g="${gap:-x}" 'BEGIN{exit !(g+0 >= 1 && g != "x" && g != "null")}' || fail "$tag: no visible gap between the </> chip and the count ($gap px)"
}

shot a-before
# The onboarding sample (the companion's "Explain this code" sends this IPC), a real AI explanation.
cdp sample "$out" "$P-sample" > "$out/cdp-sample.txt" 2>&1
sed 's/^/  cdp sample: /' "$out/cdp-sample.txt" | tee -a "$out/report.txt"
grep -q '^EXPLANATION ' "$out/cdp-sample.txt" || fail "no complete explanation of the sample"
r "EXPLANATION $(grep '^EXPLANATION ' "$out/cdp-sample.txt" | cut -d' ' -f2-)"
"$R" move 980 700
sleep 3
shot b-after-explanation
quit_app
r "app version: $(defaults read /Applications/Unvibe.app/Contents/Info.plist CFBundleShortVersionString)"
if [ "$pass" = 1 ]; then r "PASS  RC-2 row 1 compact Island"; else r "FAIL  RC-2 row 1 compact Island"; exit 1; fi
