import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BETA_INSTALL_ASSET,
  BETA_INSTALL_TAG,
  BETA_MAC_SIGNING_REQUIREMENT,
  BETA_WINDOWS_ASSET,
  betaInstallScript,
  betaWindowsInstallScript,
} from "./betaInstallScript";
import { BETA_INSTALL_VERSION } from "./betaOffer";

const HELP_URL = "https://unvibe.site/install-help";
/** The version install.sh installs by default: its tag without the "v". */
const INSTALLED_VERSION = BETA_INSTALL_TAG.replace(/^v/, "");
/**
 * The release's designated requirement, written out on purpose instead of imported: if the script's
 * pin is ever weakened (say, to an identifier-only or CN-only check), this test must fail, not follow it.
 */
const PINNED_REQUIREMENT = 'identifier "com.unvibe.app" and certificate leaf = H"c9da4f618adf98911a450e041b8f336574a99d0e"';

/**
 * Every external command the Mac script could use to change the machine is replaced by a stub
 * that only logs its arguments, one log line per call: the command name, then each argument after a
 * \x1f separator, so argument boundaries survive. `rm` forwards to the real one except for anything
 * under /Applications, so a regression can never delete an installed copy while the test runs.
 */
const STUBS: Record<string, string> = {
  uname: `[ "$1" = "-m" ] && echo arm64 || echo Darwin`,
  curl: `url=""; out=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift ;;
    http*) url="$1" ;;
  esac
  shift
done
case "$url" in
  *.dmg) cp "$FIXTURE_DMG" "$out" ;;
  *SHA256SUMS-mac.txt) [ -f "$FIXTURE_SUMS" ] || exit 22; cp "$FIXTURE_SUMS" "$out" ;;
esac
exit 0`,
  // FIXTURE_APP_LINK=1 mounts a disk image whose Unvibe.app is a symlink to a folder (Security F5).
  // Otherwise Unvibe.app's Info.plist holds FIXTURE_APP_VERSION (no Info.plist when that is empty).
  hdiutil: `if [ "$1" = "attach" ]; then
  mp=""; prev=""
  for a in "$@"; do [ "$prev" = "-mountpoint" ] && mp="$a"; prev="$a"; done
  if [ "$FIXTURE_APP_LINK" = "1" ]; then
    mkdir -p "$mp/elsewhere.app"
    ln -s "$mp/elsewhere.app" "$mp/Unvibe.app"
  else
    mkdir -p "$mp/Unvibe.app/Contents"
    if [ -n "$FIXTURE_APP_VERSION" ]; then printf '%s' "$FIXTURE_APP_VERSION" > "$mp/Unvibe.app/Contents/Info.plist"; fi
  fi
  echo "/dev/disk99	Apple_HFS	$mp"
fi
exit 0`,
  // Answers only the one query install.sh makes, with the version the hdiutil stub wrote; like the real
  // tool, a missing file or key prints an error on stdout and exits 1.
  PlistBuddy: `[ "$1" = "-c" ] && [ "$2" = "Print :CFBundleShortVersionString" ] || exit 1
cat "$3" 2>/dev/null || { echo 'Print: Entry, ":CFBundleShortVersionString", Does Not Exist'; exit 1; }`,
  // A verify passes only with the exact pinned requirement as one argument (and FIXTURE_CODESIGN_EXIT 0), so
  // a script that gates on a plain --verify can't pass. -dvv answers like codesign's own display, with an
  // ESC sequence and a C1 byte in the first signer name (a self-signer picks that name freely) and four signer lines.
  codesign: `if [ "$1" = "-dvv" ]; then
  echo "Identifier=com.unvibe.app" >&2
  printf 'Authority=Fixture \\033[2KSigner\\302\\233\\n' >&2
  echo "Authority=Fixture CA" >&2
  echo "Authority=Fixture Root" >&2
  echo "Authority=Fourth Signer" >&2
  echo "TeamIdentifier=not set" >&2
  exit 0
fi
pinned=1
for a in "$@"; do [ "$a" = "-R=$FIXTURE_PIN" ] && pinned=0; done
[ "$pinned" = 0 ] || exit 1
exit "\${FIXTURE_CODESIGN_EXIT:-0}"`,
  rm: `for a in "$@"; do case "$a" in /Applications*) exit 0 ;; esac; done
exec /bin/rm "$@"`,
  ditto: `exit "\${FIXTURE_DITTO_EXIT:-0}"`,
  mv: "exit 0",
  osascript: "exit 0",
  pkill: "exit 0",
  open: "exit 0",
  sleep: "exit 0",
  xattr: "exit 0",
};

/** One stub call: the command name, then its arguments exactly as the script passed them. */
type Call = string[];
type Run = { status: number | null; output: string; calls: Call[] };

const named = (calls: Call[], cmd: string) => calls.filter((c) => c[0] === cmd);
const show = (calls: Call[]) => calls.map((c) => c.join(" ")).join(" | ");

describe("Mac install script, run with bash against stubs", () => {
  let dir = "";
  let dmg = "";
  let dmgSha = "";

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), "unvibe-install-test-"));
    const bin = path.join(dir, "bin");
    spawnSync("mkdir", ["-p", bin]);
    for (const [name, body] of Object.entries(STUBS)) {
      const file = path.join(bin, name);
      writeFileSync(file, `#!/bin/bash\n{ printf '%s' "${name}"; for a in "$@"; do printf '\\x1f%s' "$a"; done; printf '\\n'; } >> "$STUB_LOG"\n${body}\n`);
      chmodSync(file, 0o755);
    }
    // install.sh calls PlistBuddy by its absolute path (the text test pins it); the copy under test calls the stub.
    writeFileSync(path.join(dir, "install.sh"), betaInstallScript().replaceAll("/usr/libexec/PlistBuddy", "PlistBuddy"));
    dmg = path.join(dir, "fixture.dmg");
    writeFileSync(dmg, "not really a disk image");
    dmgSha = createHash("sha256").update(readFileSync(dmg)).digest("hex");
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  /** Fixture knobs: the pinned verify's exit code, a symlinked Unvibe.app, ditto's exit code and the app's version. */
  function run(
    sums: string | null,
    fixture: { codesignExit?: number; appLink?: boolean; dittoExit?: number; appVersion?: string } = {},
  ): Run {
    const log = path.join(dir, `calls-${Math.random().toString(36).slice(2)}.log`);
    const sumsFile = path.join(dir, "SHA256SUMS-mac.txt");
    rmSync(sumsFile, { force: true });
    if (sums !== null) writeFileSync(sumsFile, sums);
    writeFileSync(log, "");
    const result = spawnSync("bash", [path.join(dir, "install.sh")], {
      encoding: "utf8",
      env: {
        NODE_ENV: "test",
        PATH: `${path.join(dir, "bin")}:/usr/bin:/bin`,
        HOME: dir,
        STUB_LOG: log,
        FIXTURE_DMG: dmg,
        FIXTURE_SUMS: sumsFile,
        FIXTURE_CODESIGN_EXIT: String(fixture.codesignExit ?? 0),
        FIXTURE_PIN: PINNED_REQUIREMENT,
        FIXTURE_APP_LINK: fixture.appLink ? "1" : "0",
        FIXTURE_DITTO_EXIT: String(fixture.dittoExit ?? 0),
        FIXTURE_APP_VERSION: fixture.appVersion ?? INSTALLED_VERSION,
      },
    });
    const calls = readFileSync(log, "utf8").split("\n").filter(Boolean).map((line) => line.split("\x1f"));
    return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
  }

  const DEST = "/Applications/Unvibe.app";
  const STAGED = `${DEST}.new`;
  const touchesApplications = (c: Call) => c.slice(1).some((a) => a.startsWith("/Applications"));
  const removesInstall = (c: Call) => c[0] === "rm" && c.includes(DEST);

  function assertNothingInstalled(r: Run) {
    for (const cmd of ["ditto", "mv", "osascript", "pkill", "open", "xattr"]) {
      assert.equal(named(r.calls, cmd).length, 0, `${cmd} must not run: ${show(r.calls)}`);
    }
    assert.ok(!named(r.calls, "rm").some(touchesApplications), "must not remove anything in /Applications");
    assert.ok(!named(r.calls, "codesign").some((c) => c.includes("--sign")), "must not re-sign");
    assert.ok(!named(r.calls, "curl").some((c) => c.some((a) => a.includes("/api/install/event"))), "must not count an install");
  }

  /** The one pinned signature check: exactly one codesign --verify, with `-R=<pin>` as one whole argument. */
  function assertOnePinnedVerify(r: Run): Call {
    const verifies = named(r.calls, "codesign").filter((c) => c.includes("--verify"));
    assert.equal(verifies.length, 1, `exactly one codesign --verify: ${show(r.calls)}`);
    const requirement = verifies[0].filter((a) => a.startsWith("-R"));
    assert.deepEqual(requirement, [`-R=${PINNED_REQUIREMENT}`], "the -R argument is exactly the pinned requirement");
    return verifies[0];
  }

  const mountPointOf = (r: Run) => {
    const attach = named(r.calls, "hdiutil").find((c) => c[1] === "attach");
    assert.ok(attach, show(r.calls));
    return attach[attach.indexOf("-mountpoint") + 1];
  };

  it("stops when the checksum file is missing", () => {
    const r = run(null);
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /checksum/i);
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.equal(named(r.calls, "hdiutil").length, 0, "must stop before mounting");
    assertNothingInstalled(r);
  });

  it("stops when the checksum file has no line for the asset", () => {
    const r = run(`${dmgSha}  Unvibe-0.1.43-mac-x64-something-else.dmg\n`);
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, new RegExp(BETA_INSTALL_ASSET.replace(/\./g, "\\.")));
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.equal(named(r.calls, "hdiutil").length, 0, "must stop before mounting");
    assertNothingInstalled(r);
  });

  it("stops when the download does not match the checksum", () => {
    const r = run(`${"0".repeat(64)}  ${BETA_INSTALL_ASSET}\n`);
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /does not match/);
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.equal(named(r.calls, "hdiutil").length, 0, "must stop before mounting");
    assertNothingInstalled(r);
  });

  it("passes a matching checksum, then stops without re-signing when the signature fails", () => {
    const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, { codesignExit: 1 });
    assert.match(r.output, /Checksum verified\./);
    assert.ok(named(r.calls, "hdiutil").some((c) => c[1] === "attach"), "a matching checksum continues to mount");
    // Only the release's own signature passes: a plain --verify also accepts an ad-hoc re-signed copy.
    assertOnePinnedVerify(r);
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /failed its signature check/);
    // The signer lines, with every non-printable byte removed and at most three of them.
    assert.ok(!/[\x00-\x09\x0b-\x1f\x7f-\x9f\ufffd]/.test(r.output), `no control bytes reach the terminal: ${JSON.stringify(r.output)}`);
    assert.match(r.output, /^Authority=Fixture \[2KSigner\nAuthority=Fixture CA\nAuthority=Fixture Root\n/m, "prints who signed the failed copy, for support");
    assert.doesNotMatch(r.output, /Fourth Signer|Identifier=|TeamIdentifier=/, "only the first three Authority lines");
    assert.ok(r.output.includes(HELP_URL), r.output);
    assertNothingInstalled(r);
  });

  it("copies exactly the checked app next to the installed one, then swaps it in, all after the signature check", () => {
    const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`);
    assert.equal(r.status, 0, r.output);
    const app = `${mountPointOf(r)}/Unvibe.app`;
    assert.equal(named(r.calls, "codesign").length, 1, `exactly one codesign call: ${show(r.calls)}`);
    const verify = assertOnePinnedVerify(r);
    assert.equal(verify[verify.length - 1], app, "codesign checks the app on the mounted image");
    const checkedAt = r.calls.indexOf(verify);
    const dittos = named(r.calls, "ditto");
    assert.equal(dittos.length, 1, `exactly one ditto: ${show(r.calls)}`);
    const copiedAt = r.calls.indexOf(dittos[0]);
    const removedAt = r.calls.findIndex(removesInstall);
    assert.ok(removedAt > copiedAt, `the installed app is removed only after the new copy is complete: ${show(r.calls)}`);
    assert.deepEqual(dittos[0], ["ditto", app, STAGED], "ditto copies exactly the checked app next to the installed one");
    assert.ok(copiedAt > checkedAt, "the copy starts after codesign");
    const versionReads = named(r.calls, "PlistBuddy");
    assert.deepEqual(versionReads, [["PlistBuddy", "-c", "Print :CFBundleShortVersionString", `${app}/Contents/Info.plist`]], "reads the mounted app's version");
    const versionAt = r.calls.indexOf(versionReads[0]);
    const firstRemoveAt = r.calls.findIndex((c) => c[0] === "rm" && touchesApplications(c));
    assert.ok(versionAt > checkedAt && versionAt < firstRemoveAt, "the version is read after codesign and before anything in /Applications is removed");
    assert.deepEqual(
      named(r.calls, "rm").filter(touchesApplications),
      [["rm", "-rf", STAGED], ["rm", "-rf", DEST]],
      "a leftover copy is cleared before copying; the installed app is removed only for the swap",
    );
    const moves = named(r.calls, "mv");
    assert.deepEqual(moves, [["mv", STAGED, DEST]], "the complete copy is moved into place");
    assert.ok(r.calls.indexOf(moves[0]) > removedAt, "mv runs after the old app is removed");
    assert.deepEqual(named(r.calls, "open"), [["open", DEST]], "opens the installed app");
  });

  it("stops after the signature check, before anything is removed, when the app is not the version it installs", () => {
    for (const appVersion of ["0.1.43", `${INSTALLED_VERSION}0`, ""]) {
      const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, { appVersion });
      assert.notEqual(r.status, 0, `version ${JSON.stringify(appVersion)} must stop: ${r.output}`);
      assert.ok(r.output.includes(`The downloaded app is not version ${INSTALLED_VERSION}. Nothing was installed`), r.output);
      assert.ok(r.output.includes(HELP_URL), r.output);
      assertOnePinnedVerify(r);
      assertNothingInstalled(r);
    }
  });

  it("keeps the installed app and stops when the copy fails", () => {
    const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, { dittoExit: 1 });
    assert.notEqual(r.status, 0, r.output);
    assert.ok(!r.calls.some(removesInstall), `the installed app is never removed: ${show(r.calls)}`);
    assert.match(r.output, /Could not copy Unvibe into Applications\. Nothing was installed, and any Unvibe you already have is unchanged\./);
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.deepEqual(
      named(r.calls, "rm").filter(touchesApplications),
      [["rm", "-rf", STAGED], ["rm", "-rf", STAGED]],
      "the partial copy is removed, and nothing else in /Applications",
    );
    for (const cmd of ["mv", "osascript", "pkill", "open"]) {
      assert.equal(named(r.calls, cmd).length, 0, `${cmd} must not run after a failed copy: ${show(r.calls)}`);
    }
    assert.ok(!named(r.calls, "curl").some((c) => c.some((a) => a.includes("/api/install/event"))), "must not count an install");
  });

  it("stops when the disk image's Unvibe.app is a symlink, before the signature check", () => {
    const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, { appLink: true });
    assert.match(r.output, /did not contain Unvibe\.app as a real folder/, r.output);
    assert.notEqual(r.status, 0, r.output);
    assert.equal(named(r.calls, "codesign").length, 0, "must stop before codesign");
    assertNothingInstalled(r);
  });
});

describe("Mac install script text", () => {
  const script = betaInstallScript();

  it("never touches extended attributes", () => {
    assert.doesNotMatch(script, /xattr/);
  });

  it("never re-signs the app", () => {
    assert.doesNotMatch(script, /codesign[^\n]*--sign/);
    assert.doesNotMatch(script, /codesign[^\n]*--force/);
  });

  it("puts the pinned requirement in single quotes it can't break out of", () => {
    assert.ok(!BETA_MAC_SIGNING_REQUIREMENT.includes("'"), BETA_MAC_SIGNING_REQUIREMENT);
    assert.ok(script.includes(`-R='${BETA_MAC_SIGNING_REQUIREMENT}'`));
  });

  it("prints at most three signer lines of the failed copy, printable characters only", () => {
    const line = `  codesign -dvv "$mountPoint/Unvibe.app" 2>&1 | grep '^Authority=' | LC_ALL=C tr -cd '[:print:]\\n' | head -n 3 >&2 || true`;
    assert.ok(script.split("\n").includes(line), "the Authority print line is exactly the sanitised one");
  });

  it("requires the mounted app's version to be the one it installs, the version the site shows", () => {
    assert.equal(BETA_INSTALL_VERSION, BETA_INSTALL_TAG, "the site's version is the tag install.sh installs");
    const lines = script.split("\n");
    assert.ok(lines.includes(`VERSION="\${TAG#v}"`), "VERSION is the tag without its v");
    assert.ok(
      lines.includes(`appVersion="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$mountPoint/Unvibe.app/Contents/Info.plist" 2>/dev/null || true)"`),
      "reads CFBundleShortVersionString from the mounted app",
    );
    assert.ok(lines.includes(`if [ "$appVersion" != "$VERSION" ]; then`), "stops unless it is exactly VERSION");
  });

  it("checks the signature, then copies next to the installed app, and only then removes it and moves the copy in", () => {
    const at = (text: string) => {
      const index = script.indexOf(text);
      assert.ok(index > 0, `the script contains ${text}`);
      return index;
    };
    const verifyAt = at("codesign --verify");
    const versionAt = at(`if [ "$appVersion" != "$VERSION" ]; then`);
    const clearAt = at(`rm -rf "$DEST.new"\nif ! ditto`);
    const copyAt = at(`if ! ditto "$mountPoint/Unvibe.app" "$DEST.new"; then`);
    const quitAt = at("osascript -e");
    const swapAt = at(`if ! { rm -rf "$DEST" && mv "$DEST.new" "$DEST"; }; then`);
    assert.ok(verifyAt < versionAt, "the version is checked after the signature");
    assert.ok(versionAt < clearAt, "the version is checked before anything in /Applications is removed");
    assert.ok(clearAt < copyAt, "a leftover copy is cleared before copying");
    assert.ok(copyAt < quitAt, "the copy is complete before the running app is closed");
    assert.ok(quitAt < swapAt, "the installed app is removed only for the swap, after the copy");
    assert.equal(script.split(`rm -rf "$DEST"`).length, 2, `exactly one rm of the installed app`);
  });

  it("discloses the installed count near the top and still sends it", () => {
    const head = script.split("\n").slice(0, 12).join("\n");
    assert.match(head, /# .*one anonymous 'installed' count to unvibe\.site/);
    assert.match(head, /no code or personal data/i);
    assert.match(script, /"event":"installed"/);
  });

  it("ends by pointing at install help", () => {
    const lines = script.trimEnd().split("\n");
    assert.ok(lines[lines.length - 1].includes(`If macOS blocks it, see ${HELP_URL}`), lines[lines.length - 1]);
  });
});

describe("Windows install script text", () => {
  const script = betaWindowsInstallScript();
  const startAt = script.indexOf("Start-Process");

  it("discloses the installed count near the top and still sends it", () => {
    const head = script.split("\n").slice(0, 8).join("\n");
    assert.match(head, /# .*one anonymous 'installed' count to unvibe\.site/);
    assert.match(head, /no code or personal data/i);
    assert.match(script, /"event":"installed"/);
  });

  it("stops before running anything when the checksum can't be confirmed", () => {
    assert.ok(script.includes("SHA256SUMS-windows.txt"));
    assert.ok(script.includes(BETA_WINDOWS_ASSET));
    assert.ok(startAt > 0);
    const verifiedAt = script.indexOf(`Write-Host "Checksum verified."`);
    assert.ok(verifiedAt > 0 && verifiedAt < startAt, "checksum is confirmed before the app runs");
    const check = script.slice(script.indexOf("SHA256SUMS-windows.txt"), verifiedAt);
    // Each failure (fetch error, no line, mismatch) goes through the stop helper.
    assert.match(check, /catch \{\s*Stop-UnvibeInstall "Could not download the published checksums/);
    assert.match(check, /if \(-not \$line\) \{ Stop-UnvibeInstall "The published checksums have no line for/);
    assert.match(check, /if \(\$expected -ne \$actual\) \{ Stop-UnvibeInstall "The download does not match/);
    assert.doesNotMatch(check, /catch \{\}/);
  });

  it("stops with a visible error and removes only the unverified download", () => {
    const helper = script.slice(script.indexOf("function Stop-UnvibeInstall"));
    const body = helper.slice(0, helper.indexOf("\n}"));
    assert.match(body, /Remove-Item[^\n]*\$download/);
    assert.doesNotMatch(body, /\$dest\b/);
    // exit closes the window under `irm | iex`, so the help link would never be seen.
    assert.doesNotMatch(body, /\bexit\b/);
    assert.match(body, /throw "\$message Nothing was installed\. For help, see https:\/\/unvibe\.site\/install-help"/);
  });

  it("matches the checksum line on the exact file name", () => {
    assert.ok(script.includes(`Where-Object { ($_.Trim() -split '\\s+')[1] -in @($asset, "*$asset") }`));
    assert.doesNotMatch(script, /-match \[regex\]::Escape\(\$asset\)/);
  });

  it("keeps the installed app until the new download is verified", () => {
    assert.ok(script.includes(`$download = "$dest.download"`));
    assert.match(script, /curl\.exe [^\n]*-o \$download /);
    assert.match(script, /Invoke-WebRequest -Uri \$url -OutFile \$download /);
    const verifiedAt = script.indexOf(`Write-Host "Checksum verified."`);
    const moveAt = script.indexOf("Move-Item -Force -Path $download -Destination $dest");
    const stopAt = script.indexOf("Stop-Process");
    assert.ok(verifiedAt > 0 && stopAt > verifiedAt, "running Unvibe is closed only after verification");
    assert.ok(moveAt > stopAt && moveAt < startAt, "the verified download replaces the app before it runs");
    const beforeMove = script.slice(0, moveAt);
    assert.doesNotMatch(beforeMove, /Remove-Item[^\n]*\$dest\b(?!\.)/, "nothing deletes the installed exe");
    assert.doesNotMatch(beforeMove, /(-o|-OutFile|-Path) \$dest\b/, "nothing writes or hashes the installed exe before the move");
  });

  it("adds a Start menu shortcut to the installed exe", () => {
    assert.ok(script.includes(`Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\Unvibe.lnk"`));
    assert.match(script, /New-Object -ComObject WScript\.Shell/);
    assert.match(script, /\.CreateShortcut\(\$shortcutPath\)/);
    assert.match(script, /\.TargetPath = \$dest/);
    assert.match(script, /\$shortcut\.Save\(\)/);
  });

  it("ends by saying where Unvibe lives", () => {
    assert.match(script, /Unvibe is in your Start menu and tray\./);
  });
});
