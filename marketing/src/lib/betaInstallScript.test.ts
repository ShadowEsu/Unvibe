import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BETA_INSTALL_ASSET,
  BETA_INSTALL_TAG,
  BETA_MAC_SIGNING_REQUIREMENT,
  BETA_WINDOWS_APP_GUID,
  BETA_WINDOWS_SETUP_ASSET,
  betaInstallScript,
  betaWindowsInstallScript,
} from "./betaInstallScript";
import { BETA_INSTALL_VERSION } from "./betaOffer";

const HELP_URL = "https://unvibe.site/install-help";
const RELEASES = "https://github.com/ShadowEsu/Unvibe/releases/download/";

/**
 * Kaspersky read "fetch a script, run a download, then call the site back" as a botnet C&C (Security R4(a)): every web
 * request a script makes reads a URL variable that is only ever a GitHub release address, and nothing is posted.
 */
function assertOnlyReleaseRequests(script: string): void {
  assert.doesNotMatch(script, /-X POST|-Method Post|Invoke-RestMethod|\/api\//i, "no request posts anything");
  const requests = script.split("\n").map((l) => l.trim())
    .filter((l) => !/^(#|echo |Write-|throw )|Get-Command/.test(l) && /\bcurl(\.exe)?\s|Invoke-WebRequest/.test(l));
  assert.ok(requests.length >= 2, `the download and its checksums: ${requests.join("\n")}`);
  for (const line of requests) {
    assert.doesNotMatch(line, /https?:\/\//, `requests use the URL variables: ${line}`);
    const used = Array.from(line.matchAll(/\$\{?(URL|SUMS_URL|url|sumsUrl)\b/g), (m) => m[1]);
    assert.equal(used.length, 1, `one URL per request: ${line}`);
    const assigned = Array.from(script.matchAll(new RegExp(`^\\s*\\$?${used[0]}\\s*=\\s*"([^"]*)"`, "gm")), (m) => m[1]);
    assert.ok(assigned.length > 0 && assigned.every((u) => u.startsWith(RELEASES)), `${used[0]} is only a GitHub release address: ${assigned.join(", ")}`);
  }
}
/** The version install.sh installs by default: its tag without the "v". */
const INSTALLED_VERSION = BETA_INSTALL_TAG.replace(/^v/, "");
/**
 * The release's designated requirement, written out on purpose instead of imported: if the script's
 * pin is ever weakened (say, to an identifier-only or CN-only check), this test must fail, not follow it.
 */
const PINNED_REQUIREMENT = 'identifier "com.unvibe.app" and certificate leaf = H"c9da4f618adf98911a450e041b8f336574a99d0e"';

/**
 * Every external command the Mac script could use to change the machine is replaced by a stub
 * that logs its arguments, one log line per call: the command name, then each argument after a
 * \x1f separator, so argument boundaries survive. The run tests point the script's DEST at a folder in
 * the test directory, so `rm`, `mv` and `ditto` (as `cp -R`) do their real work there. Each of them
 * does nothing for anything under /Applications, so a regression can never touch an installed copy.
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
  // FIXTURE_DITTO_EXIT other than 0 leaves a partial copy behind and fails, like a full disk.
  ditto: `if [ "\${FIXTURE_DITTO_EXIT:-0}" != 0 ]; then mkdir -p "$2"; exit "$FIXTURE_DITTO_EXIT"; fi
for a in "$@"; do case "$a" in /Applications*) exit 0 ;; esac; done
exec cp -R "$1" "$2"`,
  // FIXTURE_MV_FAIL makes any mv whose source ends with it fail, as a rename refused by the system would.
  mv: `if [ -n "$FIXTURE_MV_FAIL" ]; then
  case "$1" in *"$FIXTURE_MV_FAIL") echo "mv: rename $1 to $2: Operation not permitted" >&2; exit 1 ;; esac
fi
for a in "$@"; do case "$a" in /Applications*) exit 0 ;; esac; done
exec /bin/mv "$@"`,
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
  /** Stands in for /Applications. */
  let target = "";
  let DEST = "";
  let STAGED = "";
  let OLD = "";
  const OLD_VERSION = "0.1.43";
  /** Makes every folder writable again, so a read-only fixture can be deleted. */
  const unlock = (folder: string) => spawnSync("chmod", ["-R", "u+w", folder]);

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), "unvibe-install-test-"));
    target = path.join(dir, "Applications");
    DEST = path.join(target, "Unvibe.app");
    STAGED = `${DEST}.new`;
    OLD = `${DEST}.old`;
    const bin = path.join(dir, "bin");
    spawnSync("mkdir", ["-p", bin]);
    for (const [name, body] of Object.entries(STUBS)) {
      const file = path.join(bin, name);
      writeFileSync(file, `#!/bin/bash\n{ printf '%s' "${name}"; for a in "$@"; do printf '\\x1f%s' "$a"; done; printf '\\n'; } >> "$STUB_LOG"\n${body}\n`);
      chmodSync(file, 0o755);
    }
    // The copy under test calls the PlistBuddy stub and installs into the test folder; the text tests pin
    // the real PlistBuddy path and DEST.
    const script = betaInstallScript()
      .replaceAll("/usr/libexec/PlistBuddy", "PlistBuddy")
      .replace(`DEST="/Applications/Unvibe.app"`, `DEST="${DEST}"`);
    writeFileSync(path.join(dir, "install.sh"), script);
    dmg = path.join(dir, "fixture.dmg");
    writeFileSync(dmg, "not really a disk image");
    dmgSha = createHash("sha256").update(readFileSync(dmg)).digest("hex");
  });

  after(() => {
    unlock(dir);
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Fixture knobs: the pinned verify's exit code, a symlinked Unvibe.app, ditto's exit code, the mounted app's
   * version, a failing mv, and what is installed before the run: nothing, version 0.1.43 (the default), 0.1.43
   * with a read-only nested folder, or whatever the previous run left ("keep").
   */
  function run(
    sums: string | null,
    fixture: {
      codesignExit?: number;
      appLink?: boolean;
      dittoExit?: number;
      appVersion?: string;
      mvFail?: string;
      installed?: "none" | "old" | "readonly" | "keep";
    } = {},
  ): Run {
    const installed = fixture.installed ?? "old";
    if (installed !== "keep") {
      unlock(target);
      rmSync(target, { recursive: true, force: true });
      mkdirSync(target);
      if (installed !== "none") {
        mkdirSync(path.join(DEST, "Contents", "Resources"), { recursive: true });
        writeFileSync(path.join(DEST, "Contents", "Info.plist"), OLD_VERSION);
      }
      if (installed === "readonly") {
        const locked = path.join(DEST, "Contents", "Resources", "locked");
        mkdirSync(locked);
        writeFileSync(path.join(locked, "owned-by-someone-else"), "x");
        chmodSync(locked, 0o555);
      }
    }
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
        FIXTURE_MV_FAIL: fixture.mvFail ?? "",
      },
    });
    const calls = readFileSync(log, "utf8").split("\n").filter(Boolean).map((line) => line.split("\x1f"));
    return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
  }

  /** The version of the app at DEST after the run, or null when there is none. */
  function installedVersion(): string | null {
    try {
      return readFileSync(path.join(DEST, "Contents", "Info.plist"), "utf8");
    } catch {
      return null;
    }
  }

  const touchesTarget = (c: Call) => c.slice(1).some((a) => a.startsWith(target));
  const removesInstall = (c: Call) => c[0] === "rm" && c.includes(DEST);

  function assertNothingInstalled(r: Run) {
    for (const cmd of ["ditto", "mv", "osascript", "pkill", "open", "xattr"]) {
      assert.equal(named(r.calls, cmd).length, 0, `${cmd} must not run: ${show(r.calls)}`);
    }
    assert.ok(!named(r.calls, "rm").some(touchesTarget), "must not remove anything in Applications");
    assert.equal(installedVersion(), OLD_VERSION, "the installed app is unchanged");
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

  it("copies exactly the checked app next to the installed one, moves the old one aside, then moves the copy in", () => {
    const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`);
    assert.equal(r.status, 0, r.output);
    const app = `${mountPointOf(r)}/Unvibe.app`;
    assert.equal(named(r.calls, "codesign").length, 1, `exactly one codesign call: ${show(r.calls)}`);
    const verify = assertOnePinnedVerify(r);
    assert.equal(verify[verify.length - 1], app, "codesign checks the app on the mounted image");
    const checkedAt = r.calls.indexOf(verify);
    assert.ok(!r.calls.some(removesInstall), `the installed app is never deleted in place, only moved aside: ${show(r.calls)}`);
    const dittos = named(r.calls, "ditto");
    assert.deepEqual(dittos, [["ditto", app, STAGED]], "ditto copies exactly the checked app next to the installed one");
    const copiedAt = r.calls.indexOf(dittos[0]);
    assert.ok(copiedAt > checkedAt, "the copy starts after codesign");
    const versionReads = named(r.calls, "PlistBuddy");
    assert.deepEqual(versionReads, [["PlistBuddy", "-c", "Print :CFBundleShortVersionString", `${app}/Contents/Info.plist`]], "reads the mounted app's version");
    const versionAt = r.calls.indexOf(versionReads[0]);
    const firstRemoveAt = r.calls.findIndex((c) => c[0] === "rm" && touchesTarget(c));
    assert.ok(versionAt > checkedAt && versionAt < firstRemoveAt, "the version is read after codesign and before anything in Applications is removed");
    const moves = named(r.calls, "mv");
    assert.deepEqual(moves, [["mv", DEST, OLD], ["mv", STAGED, DEST]], "the old app is moved aside, then the copy is moved in");
    const removes = named(r.calls, "rm").filter(touchesTarget);
    assert.deepEqual(removes, [["rm", "-rf", STAGED], ["rm", "-rf", OLD], ["rm", "-rf", OLD]], "clears a leftover copy and a leftover .old, and deletes the old app last");
    const [asideAt, inAt, lastRemoveAt] = [r.calls.indexOf(moves[0]), r.calls.indexOf(moves[1]), r.calls.lastIndexOf(removes[2])];
    assert.ok(copiedAt < asideAt && asideAt < inAt && inAt < lastRemoveAt, `copy, move aside, move in, then delete the old app: ${show(r.calls)}`);
    assert.equal(installedVersion(), INSTALLED_VERSION, "the new version is in place");
    assert.deepEqual(readdirSync(target), ["Unvibe.app"], "no .new or .old is left behind");
    assert.deepEqual(named(r.calls, "open"), [["open", DEST]], "opens the installed app");
    // Kaspersky (Security R4(a)): a finished install must not call back to unvibe.site, only the GitHub release.
    const urls = named(r.calls, "curl").map((c) => c.find((a) => /^https?:\/\//.test(a)));
    assert.equal(urls.length, 2, `the dmg and its checksums: ${show(r.calls)}`);
    for (const url of urls) assert.ok(url?.startsWith(RELEASES), `only the GitHub release is contacted: ${url}`);
  });

  it("installs when no Unvibe is installed yet, with nothing to move aside", () => {
    const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, { installed: "none" });
    assert.equal(r.status, 0, r.output);
    assert.deepEqual(named(r.calls, "mv"), [["mv", STAGED, DEST]], "only the copy is moved");
    assert.equal(installedVersion(), INSTALLED_VERSION, "the new version is in place");
    assert.deepEqual(readdirSync(target), ["Unvibe.app"], "nothing else is left behind");
  });

  it(
    "installs over an old app it can't fully delete, and renames that leftover on the next run",
    { skip: process.getuid?.() === 0 ? "root can delete a read-only folder" : false },
    () => {
      const first = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, { installed: "readonly" });
      assert.equal(first.status, 0, `installs although the old app has a read-only nested folder: ${first.output}`);
      assert.equal(installedVersion(), INSTALLED_VERSION, "the new version is in place");
      assert.deepEqual(readdirSync(target).sort(), ["Unvibe.app", "Unvibe.app.old"], "the part of the old app it could not delete stays aside as .old");

      const second = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, { installed: "keep" });
      assert.equal(second.status, 0, `installs again with an undeletable .old present: ${second.output}`);
      assert.equal(installedVersion(), INSTALLED_VERSION, "the new version is in place");
      const leftovers = readdirSync(target).filter((name) => name !== "Unvibe.app");
      assert.equal(leftovers.length, 1, `one leftover: ${leftovers.join(", ")}`);
      assert.match(leftovers[0], /^Unvibe\.app\.old\.\d+$/, "the undeletable .old was renamed, so the app was never moved inside it");
    },
  );

  it("puts the old app back and stops when the new copy can't be moved in", () => {
    const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, { mvFail: ".new" });
    assert.notEqual(r.status, 0, r.output);
    assert.equal(installedVersion(), OLD_VERSION, `the old app is back in place: ${show(r.calls)}`);
    assert.match(r.output, /Nothing was installed, and any Unvibe you already have is unchanged\./);
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.deepEqual(named(r.calls, "mv"), [["mv", DEST, OLD], ["mv", STAGED, DEST], ["mv", OLD, DEST]], "moved aside, the move in failed, moved back");
    assert.deepEqual(readdirSync(target), ["Unvibe.app"], "the copy that could not be moved in is removed");
    assert.equal(named(r.calls, "open").length, 0, "does not open anything");
    assert.ok(!named(r.calls, "curl").some((c) => c.some((a) => a.includes("/api/install/event"))), "must not count an install");
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
    assert.equal(installedVersion(), OLD_VERSION, "the installed app is unchanged");
    assert.match(r.output, /Could not copy Unvibe into Applications\. Nothing was installed, and any Unvibe you already have is unchanged\./);
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.deepEqual(
      named(r.calls, "rm").filter(touchesTarget),
      [["rm", "-rf", STAGED], ["rm", "-rf", STAGED]],
      "the partial copy is removed, and nothing else in Applications",
    );
    assert.deepEqual(readdirSync(target), ["Unvibe.app"], "no partial copy is left behind");
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

  it("installs into /Applications/Unvibe.app", () => {
    assert.ok(script.split("\n").includes(`DEST="/Applications/Unvibe.app"`));
  });

  it("checks the signature and version, copies next to the installed app, moves it aside, moves the copy in, then deletes the old one", () => {
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
    const clearOldAt = at(`rm -rf "$DEST.old" 2>/dev/null || true\nif [ -e "$DEST.old" ]`);
    const renameOldAt = at(`mv "$DEST.old" "$DEST.old.$$" 2>/dev/null || true`);
    const asideAt = at(`if ! mv "$DEST" "$DEST.old"; then`);
    const inAt = at(`if ! mv "$DEST.new" "$DEST"; then`);
    const backAt = at(`if ! mv "$DEST.old" "$DEST"; then`);
    const deleteOldAt = script.lastIndexOf(`rm -rf "$DEST.old" 2>/dev/null || true`);
    assert.ok(verifyAt < versionAt, "the version is checked after the signature");
    assert.ok(versionAt < clearAt, "the version is checked before anything in /Applications is removed");
    assert.ok(clearAt < copyAt, "a leftover copy is cleared before copying");
    assert.ok(copyAt < quitAt, "the copy is complete before the running app is closed");
    assert.ok(quitAt < clearOldAt && clearOldAt < renameOldAt && renameOldAt < asideAt, "a leftover .old is cleared or renamed before the app is moved aside");
    assert.ok(asideAt < inAt && inAt < backAt, "moved aside, then the copy moved in, with a move back if that fails");
    assert.ok(backAt < deleteOldAt, "the old app is deleted last");
    assert.doesNotMatch(script, /rm -rf "\$DEST"(?!\.)/, "the installed app is never deleted in place");
  });

  it("contacts only the GitHub release: nothing is sent back to unvibe.site", () => {
    assertOnlyReleaseRequests(script);
    assert.match(script.split("\n").slice(0, 12).join("\n"), /# Talks only to GitHub: it sends nothing to unvibe\.site\./);
  });

  it("ends by pointing at install help, then calls main on the very last line", () => {
    const lines = script.trimEnd().split("\n");
    assert.equal(lines[lines.length - 1], "main", "main runs only once the whole script has arrived");
    assert.equal(lines[lines.length - 3], "}");
    assert.ok(lines[lines.length - 4].includes(`If macOS blocks it, see ${HELP_URL}`), lines[lines.length - 4]);
  });
});

describe("Windows install script text", () => {
  const script = betaWindowsInstallScript();
  const startAt = script.indexOf("Start-Process -FilePath $download");

  it("contacts only the GitHub release: nothing is sent back to unvibe.site", () => {
    assertOnlyReleaseRequests(script);
    assert.match(script.split("\n").slice(0, 8).join("\n"), /# Talks only to GitHub: it sends nothing to unvibe\.site\./);
  });

  it("stops before running anything when the checksum can't be confirmed", () => {
    assert.ok(script.includes("SHA256SUMS-windows.txt"));
    assert.ok(script.includes(BETA_WINDOWS_SETUP_ASSET));
    assert.ok(startAt > 0);
    const verifiedAt = script.indexOf(`Write-Host "Checksum verified."`);
    assert.ok(verifiedAt > 0 && verifiedAt < startAt, "checksum is confirmed before the installer runs");
    const check = script.slice(script.indexOf("SHA256SUMS-windows.txt"), verifiedAt);
    // Each failure (fetch error, no line, mismatch) goes through the stop helper.
    assert.match(check, /catch \{\s*Stop-UnvibeInstall "Could not download the published checksums/);
    assert.match(check, /if \(-not \$line\) \{ Stop-UnvibeInstall "The published checksums have no line for/);
    assert.match(check, /if \(\$expected -ne \$actual\) \{ Stop-UnvibeInstall "The download does not match/);
    assert.doesNotMatch(check, /catch \{\}/);
  });

  it("stops with a visible error and removes only its own temp folder", () => {
    const helper = script.slice(script.indexOf("function Stop-UnvibeInstall"));
    const body = helper.slice(0, helper.indexOf("\n}"));
    assert.match(body, /Remove-Item -Recurse -Force \$work /);
    assert.doesNotMatch(body, /LOCALAPPDATA|\$installed/);
    // exit closes the window under `irm | iex`, so the help link would never be seen.
    assert.doesNotMatch(body, /\bexit\b/);
    assert.match(body, /throw "\$message Nothing was installed\. For help, see https:\/\/unvibe\.site\/install-help"/);
    assert.match(script, /\$work = Join-Path \(\[IO\.Path\]::GetTempPath\(\)\) \("unvibe-install-" \+ \[guid\]::NewGuid\(\)/, "a fresh temp folder per run");
  });

  it("matches the checksum line on the exact file name", () => {
    assert.ok(script.includes(`Where-Object { ($_.Trim() -split '\\s+')[1] -in @($asset, "*$asset") }`));
    assert.doesNotMatch(script, /-match \[regex\]::Escape\(\$asset\)/);
  });

  it("closes Unvibe only after verification, then runs the verified download silently and waits for that process only", () => {
    const verifiedAt = script.indexOf(`Write-Host "Checksum verified."`);
    const stopAt = script.indexOf("Stop-Process");
    assert.ok(verifiedAt > 0 && stopAt > verifiedAt && stopAt < startAt, "running Unvibe is closed after verification, before the installer");
    // Plain /S: the one-click per-user setup never asks for admin and never reads the assisted setup's per-user switch.
    assert.ok(script.includes(`Start-Process -FilePath $download -ArgumentList "/S" -PassThru`));
    assert.ok(!script.includes("/currentuser"));
    // Start-Process -Wait also waits for processes the installer starts (QA's install-matrix hang).
    assert.doesNotMatch(script, /^(?!\s*#)[^\n]*Start-Process[^\n]*-Wait\b/m);
    // Windows PowerShell 5.1 only keeps ExitCode if the handle was read while the process ran.
    const handleAt = script.indexOf("$null = $setup.Handle");
    const waitAt = script.indexOf("$setup.WaitForExit(300000)");
    assert.ok(handleAt > startAt && waitAt > handleAt, "the handle is read right after the start, before the wait");
    const exitAt = script.indexOf("if ($setupExit -ne 0) {");
    const openAt = script.lastIndexOf("Start-Process $installed");
    assert.ok(exitAt > waitAt && openAt > exitAt, "Unvibe opens only after the installer exited 0");
    // 0xC0000005 gets exactly one more start of the same file, re-checked against the same checksum first.
    const retry = script.slice(script.indexOf("if ($setupExit -eq -1073741819) {"), exitAt);
    assert.equal(script.split("$setupExit = Invoke-UnvibeSetup").length - 1, 2, "one first start, one retry");
    assert.ok(retry.indexOf("(Get-FileHash -Path $download -Algorithm SHA256).Hash.ToLower() -ne $expected") > 0, retry);
    assert.ok(retry.indexOf("Get-FileHash") < retry.indexOf("$setupExit = Invoke-UnvibeSetup"), "the file is re-checked before the retry");
    assert.doesNotMatch(retry, /curl|Invoke-WebRequest/);
  });

  it("opens this user's installed app: its Apps entry first, then the per-user default, never an all-users copy", () => {
    const lookup = script.slice(script.indexOf("$installed = $null"), script.indexOf("Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue\nif (-not $installed)"));
    assert.ok(lookup.indexOf(`Get-UnvibeUninstallEntry "HKCU:"`) > 0, lookup);
    assert.ok(lookup.indexOf(`Get-UnvibeUninstallEntry "HKCU:"`) < lookup.indexOf(`"Programs\\Unvibe\\Unvibe.exe"`));
    assert.doesNotMatch(lookup, /ProgramFiles|HKLM/);
    assert.doesNotMatch(script, /Start-Process \$download(?! -ArgumentList "\/S")/);
    assert.match(script, /if \(-not \$installed\) \{\n  throw "The installer finished, but Unvibe\.exe is not/);
  });

  it("finds Unvibe's Apps entry by the installer's GUID for app/package.json's appId, not by a display name", () => {
    // electron-builder (NsisTarget): UUID v5 of the appId in namespace 50e065bc-3134-11e6-9bab-38c9862bdaf3.
    const appId = JSON.parse(readFileSync(path.join(__dirname, "../../../app/package.json"), "utf8")).build.appId as string;
    const ns = Buffer.from("50e065bc313411e69bab38c9862bdaf3", "hex");
    const h = createHash("sha1").update(Buffer.concat([ns, Buffer.from(appId)])).digest().subarray(0, 16);
    h[6] = (h[6] & 0x0f) | 0x50;
    h[8] = (h[8] & 0x3f) | 0x80;
    const hex = h.toString("hex");
    const guid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    assert.equal(BETA_WINDOWS_APP_GUID, guid);
    assert.ok(script.includes(`\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${guid}"`));
    assert.doesNotMatch(script, /DisplayName -like/);
  });

  it("removes only the portable copy earlier versions of the script left in LOCALAPPDATA\\Unvibe", () => {
    const removals = script.split("\n").filter((line) => /Remove-Item/.test(line) && /LOCALAPPDATA/.test(line));
    assert.equal(removals.length, 1, removals.join("\n"));
    assert.ok(script.includes(`foreach ($old in @("Unvibe.exe", "Unvibe.exe.download", "Unvibe.exe.old")) {`));
    assert.doesNotMatch(removals[0], /-Recurse/);
  });

  it("ends by saying where Unvibe lives and how to remove it", () => {
    assert.match(script, /Unvibe is installed for your Windows user: in your Start menu, on your desktop and in your tray\. To remove it, use Settings > Apps > Installed apps\./);
  });
});
