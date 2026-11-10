#!/bin/bash
# QA (ledger 591 C, the lead's ask; Security GO 20261109-1910 L53): the Unvibe web app (unvibe.site's manifest, #274)
# installed for real on a clean GitHub macOS runner by Chrome's WebAppInstallForceList policy, then opened from the app
# shim Chrome made, twice: with Chrome already open (launch 1, Chrome's net log on) and with Chrome closed (launch 2,
# the shim starts Chrome). Recorded: the shim's path, Info.plist, codesign -dv, spctl -a -vv, xattr; every system
# dialog (Gatekeeper's CoreServicesUIAgent expected 0); pictures of the standalone window; chrome://policy; every
# request to unvibe.site in the net log with its time, so each page load can be subtracted from the site counts (the
# install loads the policy URL, which has notrack=1; each launch loads the manifest's start_url, which has none).
# No Try request: nothing is typed or pressed in the page, and the net log must hold 0 POSTs to /api/v1/try.
# Usage: webapp-mac.sh <out dir>   Env: RUNNER_TEMP
set +e -uo pipefail
out="$1"; mkdir -p "$out"
here="$(cd "$(dirname "$0")" && pwd)"
W="$RUNNER_TEMP/gkwin"
r() { echo "$*" | tee -a "$out/report.txt"; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
t() { perl -e 'alarm shift @ARGV; exec @ARGV' "$@"; } # `open` waits while a first-open dialog is up (run 42749006494)
CH="/Applications/Google Chrome.app"
UD="$HOME/Library/Application Support/Google/Chrome"
APPS="$HOME/Applications/Chrome Apps.localized"
URL='https://unvibe.site/explain?utm_source=webapp&notrack=1'
URL_XML='https://unvibe.site/explain?utm_source=webapp&amp;notrack=1'
r "WEB APP on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m); $(spctl --status 2>&1)"
[ -d "$CH" ] || { r "FAIL  Google Chrome is not on this runner"; exit 1; }
r "Chrome $(defaults read "$CH/Contents/Info.plist" CFBundleShortVersionString)"
r "clean start: Chrome profile $([ -e "$UD" ] && echo EXISTS || echo absent); $APPS $([ -e "$APPS" ] && echo "EXISTS: $(ls "$APPS" | tr '\n' ' ')" || echo absent); Chrome running: $(pgrep -x 'Google Chrome' > /dev/null && echo yes || echo no)"

# Every system dialog, whenever it comes: time, phase, picture.
echo setup > "$out/.phase"; : > "$out/dialogs.txt"; : > "$out/.seen"
(
  while :; do
    for o in CoreServicesUIAgent UserNotificationCenter SecurityAgent universalAccessAuthWarn coreautha; do
      d=$("$W" find "$o" 2>/dev/null) || continue
      read -r id x y w h <<< "$d"
      (( w > 150 )) || continue # past the grow animation
      grep -qxF "$o $id" "$out/.seen" && continue
      echo "$o $id" >> "$out/.seen"; n=$(wc -l < "$out/.seen" | tr -d ' ')
      screencapture -x "$out/dialog-$n-full.png"; screencapture -x -o -l "$id" "$out/dialog-$n.png"
      echo "$(now) phase $(cat "$out/.phase"): dialog $n $o ${w}x${h} at $x,$y (dialog-$n.png)" >> "$out/dialogs.txt"
    done
    sleep 0.5
  done
) & watcher=$!

start_chrome() { # <net log file> <url>: Chrome as a user starts it, plus a net log
  t 30 open -a "$CH" --args --no-first-run --no-default-browser-check --log-net-log="$out/$1" --net-log-capture-mode=Default "$2"
  local i; for i in $(seq 1 30); do pgrep -x "Google Chrome" > /dev/null && return 0; sleep 1; done; return 1
}
quit_chrome() { # SIGTERM is Chrome's clean exit (the net log is closed)
  pkill -TERM -x "Google Chrome"
  local i; for i in $(seq 1 30); do pgrep -x "Google Chrome" > /dev/null || return 0; sleep 1; done
  r "NOTE  Chrome still running 30 s after SIGTERM; killed"; pkill -KILL -x "Google Chrome"; sleep 2
}
wait_shim() { # <seconds>: sets $shim
  local i
  for i in $(seq 1 "$1"); do shim=$(ls -d "$APPS"/*.app 2>/dev/null | head -1); [ -n "$shim" ] && return 0; sleep 1; done
  return 1
}
shoot() { # <label>: the screen, the window list, every layer-0 window of Chrome or the shim, pictured
  "$W" list > "$out/windows-$1.txt"
  screencapture -x "$out/$1-full-screen.png"
  awk -F'\t' -v s="${sname:-}" '($2=="Google Chrome" || $2==s) && $4=="layer=0" {print $1"\t"$2"\t"$3"\t"$6}' "$out/windows-$1.txt" > "$out/.cw"
  local id owner title size
  while IFS=$'\t' read -r id owner title size; do
    screencapture -x -o -l "$id" "$out/$1-window-$id.png"
    r "  $1: window $id of '$owner', title '$title', $size (picture $1-window-$id.png)"
  done < "$out/.cw"
}

# 1 The policy, as the lead wrote it (user-level defaults); read back through plistlib.
defaults write com.google.Chrome WebAppInstallForceList -array "<dict><key>url</key><string>$URL_XML</string><key>default_launch_container</key><string>window</string><key>create_desktop_shortcut</key><false/></dict>"
back=$(defaults export com.google.Chrome - | python3 -c 'import plistlib,sys; print(plistlib.loads(sys.stdin.buffer.read())["WebAppInstallForceList"][0]["url"])' 2>&1)
r "policy (user defaults com.google.Chrome WebAppInstallForceList): $(defaults read com.google.Chrome WebAppInstallForceList | tr -s ' \n' ' ')"
r "$([ "$back" = "$URL" ] && echo PASS || echo FAIL)  the policy's url reads back as $back"

# The runner's Chrome is quarantined (Homebrew Cask), so with Gatekeeper on its own first open asks "“Google Chrome” is
# an app downloaded from the Internet" (run 42749006494, which hung there). Someone who uses Chrome answered that once
# long ago, so it is cleared here as that stand-in; it is about Chrome, not the web app.
r "Chrome's quarantine before: $(xattr -p com.apple.quarantine "$CH" 2>/dev/null || echo none)"
sudo xattr -dr com.apple.quarantine "$CH" 2>/dev/null; r "Chrome's quarantine now: $(xattr -p com.apple.quarantine "$CH" 2>/dev/null || echo none) (stand-in for a Chrome the user already opened)"
mkdir -p "$UD"; touch "$UD/First Run"
echo install > "$out/.phase"
route=user
t_start=$(now); start_chrome netlog-1.json "chrome://policy" || r "FAIL  Chrome did not start"
r "Chrome started at $t_start (tab chrome://policy, net log netlog-1.json); waiting up to 180 s for the app shim"
if ! wait_shim 180; then
  shoot 1-no-shim-user-policy
  r "NOTE  no app shim 180 s after the start with the user-level policy; the same policy now as a managed (mandatory) preference"
  quit_chrome
  python3 - "$RUNNER_TEMP/com.google.Chrome.plist" "$URL" <<'PY'
import plistlib, sys
plistlib.dump({"WebAppInstallForceList": [{"url": sys.argv[2], "default_launch_container": "window", "create_desktop_shortcut": False}]}, open(sys.argv[1], "wb"))
PY
  sudo mkdir -p "/Library/Managed Preferences/$USER"
  sudo cp "$RUNNER_TEMP/com.google.Chrome.plist" "/Library/Managed Preferences/com.google.Chrome.plist"
  sudo cp "$RUNNER_TEMP/com.google.Chrome.plist" "/Library/Managed Preferences/$USER/com.google.Chrome.plist"
  sudo chown -R root:wheel "/Library/Managed Preferences"; sudo killall cfprefsd 2>/dev/null; sleep 2
  route=managed
  t_start=$(now); start_chrome netlog-1b.json "chrome://policy" || r "FAIL  Chrome did not start"
  r "Chrome started again at $t_start with the managed policy (net log netlog-1b.json); waiting up to 180 s"
  if ! wait_shim 180; then
    shoot 1-no-shim-managed-policy
    r "FAIL  no app shim in $APPS 180 s after the start with the managed policy either"
    quit_chrome; kill "$watcher" 2>/dev/null
    for f in "$out"/netlog-*.json; do python3 "$here/netlog-summary.py" "$f" "$(basename "$f" .json)" | tee -a "$out/report.txt"; done
    exit 1
  fi
fi
r "PASS  app shim made by Chrome ($route policy) at $(now): $shim"
sleep 10 # Chrome finishes the shim's icon and Info.plist
sname=$(basename "$shim" .app)
shoot 1-installed-chrome-policy-tab

# 2 The shim as made: where, what, how it is signed, what Gatekeeper says, quarantine.
r "SHIM $(ls -ld "$shim")"
r "  $APPS holds: $(ls "$APPS" | tr '\n' ' ')"
plutil -p "$shim/Contents/Info.plist" > "$out/shim-Info.plist.txt" 2>&1
r "  Info.plist: $(grep -E 'CFBundleIdentifier|CFBundleName|CFBundleExecutable|CrAppMode|LSMinimumSystemVersion' "$out/shim-Info.plist.txt" | sed 's/^ *//' | tr '\n' ' ')"
codesign -dv --verbose=4 "$shim" > "$out/shim-codesign-dv.txt" 2>&1
r "  codesign -dv: exit $?; $(grep -E '^(Identifier|Format|CodeDirectory|Signature|Authority|TeamIdentifier|flags|Sealed)' "$out/shim-codesign-dv.txt" | tr '\n' ' ')"
codesign --verify --deep --strict -v "$shim" > "$out/shim-codesign-verify.txt" 2>&1
r "  codesign --verify --deep --strict: exit $?; $(tr '\n' ' ' < "$out/shim-codesign-verify.txt")"
spctl -a -vv "$shim" > "$out/shim-spctl.txt" 2>&1
r "  spctl -a -vv: exit $?; $(tr '\n' ' ' < "$out/shim-spctl.txt")"
xattr -l "$shim" > "$out/shim-xattr.txt" 2>&1
r "  xattr: $([ -s "$out/shim-xattr.txt" ] && tr '\n' ' ' < "$out/shim-xattr.txt" | cut -c1-300 || echo none)"
q=$(xattr -p com.apple.quarantine "$shim" 2>/dev/null)
r "$([ -z "$q" ] && echo PASS || echo NOTE)  com.apple.quarantine on the shim: ${q:-none}"

# 3 Launch 1, Chrome open: the shim opened as a user opens it from ~/Applications or the Dock.
echo launch-1-warm > "$out/.phase"
t_l1=$(now); t 30 open -a "$shim"; rc=$?
r "LAUNCH 1 (Chrome open): open -a \"$shim\" at $t_l1, exit $rc"
sleep 12
shoot 2-launch1
r "  processes: $(ps -axo pid=,args= | grep -E 'Chrome Apps|app_mode_loader' | grep -v grep | cut -c1-200 | tr '\n' ';')"
quit_chrome # closes netlog-1*.json
sleep 3

# 4 Launch 2, Chrome closed: the shim starts Chrome (no net log; nothing pressed).
echo launch-2-cold > "$out/.phase"
t_l2=$(now); t 30 open -a "$shim"; rc=$?
r "LAUNCH 2 (Chrome closed): open -a \"$shim\" at $t_l2, exit $rc"
sleep 20
shoot 3-launch2
r "  processes: $(ps -axo pid=,args= | grep -E 'Chrome Apps|app_mode_loader|Google Chrome.app/Contents/MacOS' | grep -v grep | cut -c1-200 | tr '\n' ';')"
quit_chrome
sleep 3; kill "$watcher" 2>/dev/null

# 5 The window, each launch: a window of the shim (or a Chrome window titled Unvibe) on screen.
for l in 2-launch1 3-launch2; do
  hit=$(awk -F'\t' -v s="$sname" '$4=="layer=0" && ($2==s || ($2=="Google Chrome" && $3 ~ /Unvibe/))' "$out/windows-$l.txt" | head -1)
  r "$([ -n "$hit" ] && echo PASS || echo FAIL)  $l: the web app's window is on screen: $(printf '%s' "${hit:-none}" | tr '\t' ' ')"
done

# 6 Dialogs and the net log.
gk=$(grep -E 'phase launch-' "$out/dialogs.txt" | grep -c CoreServicesUIAgent)
r "$([ "$gk" = 0 ] && echo PASS || echo FAIL)  Gatekeeper (CoreServicesUIAgent) windows while the web app opened (launches 1 and 2): $gk"
r "every system dialog seen: $([ -s "$out/dialogs.txt" ] && tr '\n' ';' < "$out/dialogs.txt" || echo none)"
tries=0
for f in "$out"/netlog-*.json; do
  python3 "$here/netlog-summary.py" "$f" "$(basename "$f" .json)" > "$out/$(basename "$f" .json)-unvibe.txt" 2>&1
  cat "$out/$(basename "$f" .json)-unvibe.txt" | tee -a "$out/report.txt"
  n=$(sed -n 's/^COUNT .* try_posts=\([0-9]*\)$/\1/p' "$out/$(basename "$f" .json)-unvibe.txt"); tries=$(( tries + ${n:-1000} ))
done
r "$([ "$tries" = 0 ] && echo PASS || echo FAIL)  POSTs to /api/v1/try in the net log: $tries (launch 2 had no net log; nothing was typed or pressed in it)"
r "LOADS for the site counts (UTC): Chrome start + install $t_start (policy URL, notrack=1); launch 1 $t_l1; launch 2 $t_l2 (each launch loads the start_url /explain?utm_source=webapp, no notrack; net log lines above give the exact times)"
gzip -9 "$out"/netlog-*.json
grep -q '^FAIL' "$out/report.txt" && exit 1
exit 0
