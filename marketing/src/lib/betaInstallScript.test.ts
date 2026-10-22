import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BETA_INSTALL_ASSET,
  BETA_WINDOWS_ASSET,
  betaInstallScript,
  betaWindowsInstallScript,
} from "./betaInstallScript";

const HELP_URL = "https://unvibe.site/install-help";

/**
 * Every external command the Mac script could use to change the machine is replaced by a stub
 * that only logs its arguments. `rm` forwards to the real one except for anything under
 * /Applications, so a regression can never delete an installed copy while the test runs.
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
  hdiutil: `if [ "$1" = "attach" ]; then
  mp=""; prev=""
  for a in "$@"; do [ "$prev" = "-mountpoint" ] && mp="$a"; prev="$a"; done
  mkdir -p "$mp/Unvibe.app"
  echo "/dev/disk99	Apple_HFS	$mp"
fi
exit 0`,
  codesign: `exit "\${FIXTURE_CODESIGN_EXIT:-0}"`,
  rm: `for a in "$@"; do case "$a" in /Applications*) exit 0 ;; esac; done
exec /bin/rm "$@"`,
  ditto: "exit 0",
  osascript: "exit 0",
  pkill: "exit 0",
  open: "exit 0",
  sleep: "exit 0",
  xattr: "exit 0",
};

type Run = { status: number | null; output: string; calls: string[] };

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
      writeFileSync(file, `#!/bin/bash\necho "${name} $*" >> "$STUB_LOG"\n${body}\n`);
      chmodSync(file, 0o755);
    }
    writeFileSync(path.join(dir, "install.sh"), betaInstallScript());
    dmg = path.join(dir, "fixture.dmg");
    writeFileSync(dmg, "not really a disk image");
    dmgSha = createHash("sha256").update(readFileSync(dmg)).digest("hex");
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  function run(sums: string | null, codesignExit = 0): Run {
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
        FIXTURE_CODESIGN_EXIT: String(codesignExit),
      },
    });
    const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);
    return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
  }

  function assertNothingInstalled(r: Run) {
    for (const cmd of ["ditto", "osascript", "pkill", "open", "xattr"]) {
      assert.ok(!r.calls.some((c) => c.startsWith(`${cmd} `)), `${cmd} must not run: ${r.calls.join(" | ")}`);
    }
    assert.ok(!r.calls.some((c) => c.startsWith("rm ") && c.includes("/Applications")), "must not remove the installed app");
    assert.ok(!r.calls.some((c) => c.startsWith("codesign ") && c.includes("--sign")), "must not re-sign");
    assert.ok(!r.calls.some((c) => c.startsWith("curl ") && c.includes("/api/install/event")), "must not count an install");
  }

  it("stops when the checksum file is missing", () => {
    const r = run(null);
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /checksum/i);
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.ok(!r.calls.some((c) => c.startsWith("hdiutil attach")), "must stop before mounting");
    assertNothingInstalled(r);
  });

  it("stops when the checksum file has no line for the asset", () => {
    const r = run(`${dmgSha}  Unvibe-0.1.43-mac-x64-something-else.dmg\n`);
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, new RegExp(BETA_INSTALL_ASSET.replace(/\./g, "\\.")));
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.ok(!r.calls.some((c) => c.startsWith("hdiutil attach")), "must stop before mounting");
    assertNothingInstalled(r);
  });

  it("stops when the download does not match the checksum", () => {
    const r = run(`${"0".repeat(64)}  ${BETA_INSTALL_ASSET}\n`);
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /does not match/);
    assert.ok(r.output.includes(HELP_URL), r.output);
    assert.ok(!r.calls.some((c) => c.startsWith("hdiutil attach")), "must stop before mounting");
    assertNothingInstalled(r);
  });

  it("passes a matching checksum, then stops without re-signing when the signature fails", () => {
    const r = run(`${dmgSha}  ${BETA_INSTALL_ASSET}\n`, 1);
    assert.match(r.output, /Checksum verified\./);
    assert.ok(r.calls.some((c) => c.startsWith("hdiutil attach")), "a matching checksum continues to mount");
    assert.ok(r.calls.some((c) => c.startsWith("codesign --verify")), r.calls.join(" | "));
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /signature/i);
    assert.ok(r.output.includes(HELP_URL), r.output);
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
