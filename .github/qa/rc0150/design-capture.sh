#!/bin/bash
# Design package stills from the RC-2 arm64 build: Briefs with one real brief of a throwaway sample repo (no personal
# data), then Settings → Privacy & Data. 1x captures of the real window and 2x captures through CDP emulation (cdp.mjs
# design). The project is chosen through the app's own folder dialog; only if that can't be driven is the app's
# remembered project (settings lastProjectRoot, what a pick stores) seeded instead, and the report says so.
# Usage: design-capture.sh <out dir>
set +e -uo pipefail
out="$1"; mkdir -p "$out"
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
RCMAC="$R" GKWIN="$W" PICK_PATH="$repo" t 300 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" design "$out" design > "$out/cdp-design.txt" 2>&1
if grep -q '^ERROR PICK_FAILED' "$out/cdp-design.txt"; then
  r "the folder dialog could not be driven; SEEDING lastProjectRoot (what a pick stores) and starting again"
  sed 's/^/  cdp (pick attempt): /' "$out/cdp-design.txt" | tee -a "$out/report.txt"
  quit_app
  python3 - "$ud/unvibe-settings.json" "$repo" <<'EOF'
import json, sys
p = sys.argv[1]; s = json.load(open(p)); s["lastProjectRoot"] = sys.argv[2]; json.dump(s, open(p, "w"))
EOF
  launch; sleep 10
  SKIP_PICK=1 RCMAC="$R" GKWIN="$W" t 300 node "$RUNNER_TEMP/pw/rc0150-cdp.mjs" design "$out" design > "$out/cdp-design.txt" 2>&1
  r "PROJECT seeded lastProjectRoot (not picked through the dialog)"
else
  r "PROJECT chosen through the app's folder dialog"
fi
sed 's/^/  cdp: /' "$out/cdp-design.txt" | tee -a "$out/report.txt"
grep -q '^ERROR' "$out/cdp-design.txt" && fail=1
for f in briefs-open-1x briefs-open-2x settings-privacy-1x settings-privacy-2x; do
  r "$f.png: $(sips -g pixelWidth -g pixelHeight "$out/$f.png" 2>/dev/null | awk '/pixel/ {printf "%s ", $2}')"
done
r "settings lastProjectRoot after: $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("lastProjectRoot"))' "$ud/unvibe-settings.json")"
quit_app
[ "$fail" = 0 ] && r "PASS  design capture" || { r "FAIL  design capture"; exit 1; }
