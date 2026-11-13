#!/bin/bash
# Design package stills from the RC-2 arm64 build: Briefs with one real brief of a throwaway sample repo (no personal
# data), then Settings → Privacy & Data. 1x captures of the real window and 2x captures through CDP emulation (cdp.mjs
# design). The project is chosen through the app's own folder dialog; only if that can't be driven is the app's
# remembered project (settings lastProjectRoot, what a pick stores) seeded instead, and the report says so.
# s10 (Studio's S10, Marketing's ask 20261113-0108): the same repo plus Marketing's third commit (s10-commit3.patch,
# Security S-2 GO), whose id must come out 0d41a63; then Briefs only, through cdp.mjs brief (local git, no hosted call):
# the whole brief in one tall 2x still, the same screen at 1x, the real window at 1x, and every number checked.
# Usage: design-capture.sh <out dir> [s10]
set +e -uo pipefail
out="$1"; kind="${2:-design}"; mkdir -p "$out"
cmode=design; [ "$kind" = s10 ] && cmode=brief
. "$(dirname "$0")/lib.sh"
fail=0

r "DESIGN CAPTURE on macOS $(sw_vers -productVersion) ($(sw_vers -buildVersion)), $(uname -m)"
build_rcmac || r "NOTE  helper did not build"
r "SCREEN $("$R" screen)"

# The sample project: a tiny cart module, a base commit, then a realistic small change. No personal data.
repo="$HOME/Projects/sample-cart"; rm -rf "$repo"; mkdir -p "$repo/src" "$repo/test"
export GIT_AUTHOR_NAME="Sample Dev" GIT_AUTHOR_EMAIL="sample@example.com" GIT_COMMITTER_NAME="Sample Dev" GIT_COMMITTER_EMAIL="sample@example.com"
cd "$repo" && git init -q -b main
printf '# sample-cart\n\nA tiny shopping-cart helper used as sample data.\n' > README.md
printf '{\n  "name": "sample-cart",\n  "version": "1.0.0",\n  "type": "module"\n}\n' > package.json
printf 'export function subtotal(items) {\n  return items.reduce((sum, item) => sum + item.price * item.qty, 0);\n}\n\nexport function total(items, taxRate) {\n  return subtotal(items) * (1 + taxRate);\n}\n' > src/cart.js
git add -A && GIT_AUTHOR_DATE="2026-11-04T10:00:00Z" GIT_COMMITTER_DATE="2026-11-04T10:00:00Z" git commit -q -m "Add cart subtotal and total"
cat > src/cart.js <<'EOF'
const DISCOUNTS = { SPRING10: 0.1, WELCOME5: 0.05 };

export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/** Applies a known discount code; unknown or missing codes leave the amount unchanged. */
export function applyDiscount(amount, code) {
  const rate = DISCOUNTS[code?.toUpperCase()] ?? 0;
  return amount * (1 - rate);
}

export function total(items, taxRate, code) {
  const discounted = applyDiscount(subtotal(items), code);
  return Math.round(discounted * (1 + taxRate) * 100) / 100;
}
EOF
cat > test/cart.test.js <<'EOF'
import { strict as assert } from 'node:assert';
import { applyDiscount, total } from '../src/cart.js';

assert.equal(applyDiscount(100, 'spring10'), 90);
assert.equal(applyDiscount(100, 'UNKNOWN'), 100);
assert.equal(total([{ price: 19.99, qty: 3 }], 0.08, 'WELCOME5'), 61.53);
EOF
printf '# sample-cart\n\nA tiny shopping-cart helper used as sample data.\n\n## Discount codes\n\n`total(items, taxRate, code)` accepts SPRING10 or WELCOME5 and rounds to cents.\n' > README.md
git add -A && GIT_AUTHOR_DATE="2026-11-05T15:30:00Z" GIT_COMMITTER_DATE="2026-11-05T15:30:00Z" git commit -q -m "Add discount codes and round totals to cents"
if [ "$kind" = s10 ]; then
  # Marketing's commit, as Security read it: the patch's own sha256 first, then the same author, committer and dates
  # as Marketing's, so the id is the one Marketing and Security checked.
  patch="$here/s10-commit3.patch" # lib.sh's absolute script dir (this shell is in the sample repo now)
  got=$(shasum -a 256 "$patch" | cut -d' ' -f1)
  [ "$got" = c279c3618879f906ee8e80aa13a706d76f195a6a1dbad8adedf45e1ee33fe4b3 ] || { r "FAIL  s10-commit3.patch sha256 $got, not c279c361 (Security S-2)"; exit 1; }
  git apply --index "$patch" || { r "FAIL  s10-commit3.patch does not apply on $(git rev-parse --short HEAD)"; exit 1; }
  GIT_AUTHOR_DATE="2026-11-06T09:00:00Z" GIT_COMMITTER_DATE="2026-11-06T09:00:00Z" git commit -q -m "Add quantity limits and a receipt line"
  head=$(git rev-parse HEAD)
  [ "$head" = 0d41a63de9c04faf45e7900469fc1829b83b3b1f ] || { r "FAIL  sample commit is $head, not Marketing's 0d41a63de9c04faf45e7900469fc1829b83b3b1f"; exit 1; }
  r "PASS  sample commit 0d41a63de9c04faf45e7900469fc1829b83b3b1f (patch sha256 c279c361), numstat: $(git diff --numstat HEAD~1 HEAD | tr '\t\n' ' ;')"
fi
{ echo "sample repo $repo"; git log --format='%h %an <%ae> %ad %s' --date=iso; git show --stat --format= HEAD; git ls-files; } > "$out/sample-repo.txt"
git show HEAD > "$out/sample-repo-latest.diff"
cd - > /dev/null
r "sample repo: $(git -C "$repo" log --format='%s' | tr '\n' '|'); latest: $(git -C "$repo" show --shortstat --format= HEAD | tr -s ' ')"

# A set-up profile; the send agreement is NOT seeded (Briefs reads git locally; Privacy shows the real state).
rm -rf "$ud"; mkdir -p "$ud"
printf '{"installId":"%s"}' "$INSTALL_ID" > "$ud/unvibe-store.json"
printf '{"settingsRevision":8,"appearanceRevision":2,"onboarded":true,"theme":"light"}' > "$ud/unvibe-settings.json"
utcc "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier_type,indirect_object_identifier,flags) VALUES('kTCCServiceAppleEvents','com.unvibe.app',0,2,2,1,0,'com.apple.systemevents',0);"
killall -u "$USER" tccd 2>/dev/null
r "profile: onboarded, light, Automation Allow seeded (no System Events question over the stills), no send agreement"

launch
sleep 10
flag first-contact || { r "FAIL  QA flag after first contact"; fail=1; }
RCMAC="$R" GKWIN="$W" PICK_PATH="$repo" t 300 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" "$cmode" "$out" "$cmode" > "$out/cdp-$cmode.txt" 2>&1
if grep -q '^ERROR PICK_FAILED' "$out/cdp-$cmode.txt"; then
  r "the folder dialog could not be driven; SEEDING lastProjectRoot (what a pick stores) and starting again"
  sed 's/^/  cdp (pick attempt): /' "$out/cdp-$cmode.txt" | tee -a "$out/report.txt"
  quit_app
  python3 - "$ud/unvibe-settings.json" "$repo" <<'EOF'
import json, sys
p = sys.argv[1]; s = json.load(open(p)); s["lastProjectRoot"] = sys.argv[2]; json.dump(s, open(p, "w"))
EOF
  launch; sleep 10
  SKIP_PICK=1 RCMAC="$R" GKWIN="$W" t 300 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" "$cmode" "$out" "$cmode" > "$out/cdp-$cmode.txt" 2>&1
  r "PROJECT seeded lastProjectRoot (not picked through the dialog)"
else
  r "PROJECT chosen through the app's folder dialog"
fi
sed 's/^/  cdp: /' "$out/cdp-$cmode.txt" | tee -a "$out/report.txt"
grep -q '^ERROR' "$out/cdp-$cmode.txt" && fail=1
stills="briefs-open-1x briefs-open-2x settings-privacy-1x settings-privacy-2x"
[ "$kind" = s10 ] && stills="briefs-window-1x briefs-full-1x briefs-full-2x briefs-open-2x"
for f in $stills; do
  r "$f.png: $(sips -g pixelWidth -g pixelHeight "$out/$f.png" 2>/dev/null | awk '/pixel/ {printf "%s ", $2}')"
done
if [ "$kind" = s10 ]; then
  # Every number Marketing will check on the stills, against `git diff --numstat 83cf6c0 0d41a63` (the ask's table).
  cp "$out/cdp-brief.json" "$out/capture-data.json" 2>/dev/null
  python3 - "$out/cdp-brief.json" <<'EOF' | tee -a "$out/report.txt"
import json, sys
want = {"README.md": (4, 0), "src/cart.js": (10, 1), "src/format.js": (4, 0), "src/limits.js": (9, 0),
        "test/cart.test.js": (4, 1), "test/format.test.js": (5, 0), "test/limits.test.js": (8, 0)}
try:
    b = json.load(open(sys.argv[1]))["brief"]
except Exception as e:
    print(f"FAIL  no brief in cdp-brief.json ({e})"); sys.exit(0)
meta, files, main = b.get("meta", []), b.get("files", []), b.get("mainChanges", [])
head, rows = b.get("reviewHead") or "", b.get("whatMatters") or []
ok = lambda c, what: print(f"{'PASS' if c else 'FAIL'}  {what}")
ok("7 files changed" in meta and "+44 / -2" in meta, f"brief header: 7 files changed, +44 / -2 (shown: {meta})")
ok("7 files changed, +44 / -2" in head, f"after-agent review header: 7 files changed, +44 / -2 (shown: {head[:120]})")
# 0.1.51 shows the top 5 ranked files under What matters and the first 6 under Main changes (agentReview.ts
# ranked.slice(0, 5), changeBrief.ts files.slice(0, 6)); Files lists all of them. Every row shown must carry its
# file's real counts.
for path, (a, d) in want.items():
    ok(f"{path}+{a} / -{d}" in files, f"Files row {path} +{a} / -{d}")
ok(len(files) == 7, f"Files lists all 7 (shown: {len(files)})")
for r in rows:
    a, d = want.get(r.get("path"), (None, None))
    ok(a is not None and r.get("counts") == f"+{a} / -{d}", f"What matters row carries its file's counts: {r.get('path')} {r.get('counts')} ({r.get('reason')})")
for line in main:
    hit = [p for p in want if f" {p} (" in line]
    ok(len(hit) == 1 and f"({want[hit[0]][0]}+ / {want[hit[0]][1]}-)" in line, f"Main changes line carries its file's counts: {line}")
ok(len(rows) > 0 and len(main) > 0, f"What matters and Main changes have rows (shown: What matters {len(rows)}, Main changes {len(main)}, Files {len(files)})")
EOF
fi
r "settings lastProjectRoot after: $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("lastProjectRoot"))' "$ud/unvibe-settings.json")"
quit_app
[ "$fail" = 0 ] && ! grep -q '^FAIL' "$out/report.txt" && r "PASS  $kind capture" || { r "FAIL  $kind capture"; exit 1; }
