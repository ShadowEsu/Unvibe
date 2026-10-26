import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAC_SIGNING_REQUIREMENT, macUpdateScript, verifyDownload } from '../src/main/updater';

/**
 * The release's designated requirement, written out on purpose instead of imported. It must equal
 * BETA_MAC_SIGNING_REQUIREMENT in marketing/src/lib/betaInstallScript.ts, whose test pins the same
 * literal: if either copy is weakened or changed, a test fails instead of following it.
 */
const PINNED_REQUIREMENT = 'identifier "com.unvibe.app" and certificate leaf = H"c9da4f618adf98911a450e041b8f336574a99d0e"';

const RELEASE = 'https://github.com/ShadowEsu/Unvibe/releases/download/v0.1.45';

test('the macOS helper verifies the mounted app with the pinned requirement before touching the installed app, and never re-signs', () => {
  assert.equal(MAC_SIGNING_REQUIREMENT, PINNED_REQUIREMENT, 'the app pins the same requirement as install.sh');
  const script = macUpdateScript({ pid: 4242, file: '/w/Unvibe.dmg', dir: '/w', mount: '/w/mnt', target: '/Applications/Unvibe.app' });
  const verify = script.indexOf(`codesign --verify --deep --strict -R='${PINNED_REQUIREMENT}' '/w/mnt/Unvibe.app'`);
  const remove = script.indexOf(`rm -rf '/Applications/Unvibe.app'`);
  assert.ok(verify >= 0, 'the mounted app is checked against the pinned requirement');
  assert.ok(remove >= 0);
  assert.ok(verify < remove, 'the pinned verify comes before rm -rf of the installed app');
  assert.ok(script.indexOf('xattr') > verify, 'quarantine is cleared only after the check');
  assert.doesNotMatch(script, /--sign/, 'the helper never re-signs');
});

/**
 * Runs the generated helper with every command that could change the machine replaced by a stub
 * that logs its arguments. The installed app is a folder with a marker file in a scratch directory.
 */
function runHelper(codesignExit: number) {
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-updater-test-'));
  const bin = path.join(root, 'bin');
  const dir = path.join(root, 'work');
  const target = path.join(root, 'installed', 'Unvibe.app');
  const log = path.join(root, 'calls.log');
  mkdirSync(bin);
  mkdirSync(dir);
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(target, 'marker'), 'OLD');
  const stubs: Record<string, string> = {
    hdiutil: `echo "hdiutil $*" >> "$LOG"
if [ "$1" = "attach" ]; then
  mp=""; prev=""
  for a in "$@"; do [ "$prev" = "-mountpoint" ] && mp="$a"; prev="$a"; done
  mkdir -p "$mp/Unvibe.app"; echo NEW > "$mp/Unvibe.app/marker"
fi
exit 0`,
    codesign: `echo "codesign $*" >> "$LOG"; exit ${codesignExit}`,
    open: 'echo "open $*" >> "$LOG"; exit 0',
    ditto: 'echo "ditto $*" >> "$LOG"; exec cp -R "$1" "$2"',
    xattr: 'echo "xattr $*" >> "$LOG"; exit 0',
    rm: `for a in "$@"; do case "$a" in /Applications*) exit 0 ;; esac; done
exec /bin/rm "$@"`,
  };
  for (const [name, body] of Object.entries(stubs)) {
    writeFileSync(path.join(bin, name), `#!/bin/bash\n${body}\n`);
    chmodSync(path.join(bin, name), 0o755);
  }
  // A process that has already exited, so the helper does not wait for Unvibe to quit.
  const pid = spawnSync(process.execPath, ['-e', '0']).pid;
  const script = path.join(dir, 'update.sh');
  writeFileSync(script, macUpdateScript({ pid, file: path.join(dir, 'Unvibe.dmg'), dir, mount: path.join(dir, 'mnt'), target }));
  const result = spawnSync('/bin/bash', [script], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LOG: log }, encoding: 'utf8' });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  const marker = readFileSync(path.join(target, 'marker'), 'utf8').trim();
  rmSync(root, { recursive: true, force: true });
  return { status: result.status, calls, marker, target, dir };
}

test('a mounted app that fails the signature check leaves the installed app untouched and reopens it', { skip: process.platform === 'win32' }, () => {
  const run = runHelper(1);
  assert.equal(run.marker, 'OLD', 'the installed app is untouched');
  assert.ok(run.calls.includes(`open ${run.target}`), 'the old app is opened again');
  assert.equal(run.status, 1, 'the stop is reported like the helper\'s other failures (exit 1)');
  assert.ok(!run.calls.some((c) => c.startsWith('ditto') || c.startsWith('xattr')), 'nothing is copied in');
  assert.ok(run.calls.some((c) => c.startsWith('hdiutil detach')), 'the image is detached');

  const ok = runHelper(0);
  assert.equal(ok.marker, 'NEW', 'a build that passes replaces the installed app');
  assert.equal(ok.status, 0);
  assert.ok(ok.calls.includes(`codesign --verify --deep --strict -R=${PINNED_REQUIREMENT} ${ok.dir}/mnt/Unvibe.app`), 'the mounted app, not the installed one, is verified');
  assert.ok(ok.calls.includes(`open ${ok.target}`));
});

function fakeFetch(body: string | null, status = 200) {
  const urls: string[] = [];
  const fetchImpl = async (url: string): Promise<Response> => {
    urls.push(url);
    if (body === null) throw new Error('offline');
    return new Response(body, { status });
  };
  return { urls, fetchImpl };
}

function download(content: string): { file: string; sha: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-updater-test-'));
  const file = path.join(root, 'download');
  writeFileSync(file, content);
  return { file, sha: createHash('sha256').update(content).digest('hex'), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('a macOS download that does not match the published checksum is refused', async () => {
  const dl = download('the real disk image');
  const asset = 'Unvibe-0.1.45-mac-arm64.dmg';
  const other = 'f'.repeat(64);
  try {
    const good = fakeFetch(`${other}  Unvibe-0.1.45-mac-x64.dmg\n${dl.sha}  ${asset}\n`);
    assert.equal(await verifyDownload(dl.file, `${RELEASE}/${asset}`, 'darwin', good.fetchImpl), null);
    assert.deepEqual(good.urls, [`${RELEASE}/SHA256SUMS-mac.txt`], 'the checksum file comes from the same tag');

    const bad = fakeFetch(`${other}  ${asset}\n`);
    assert.match(await verifyDownload(dl.file, `${RELEASE}/${asset}`, 'darwin', bad.fetchImpl) ?? '', /does not match its published checksum/, 'a mismatch is refused');
    const missingLine = fakeFetch(`${dl.sha}  Unvibe-0.1.45-mac-x64.dmg\n`);
    assert.match(await verifyDownload(dl.file, `${RELEASE}/${asset}`, 'darwin', missingLine.fetchImpl) ?? '', /no line for/);
    const missingFile = fakeFetch('Not Found', 404);
    assert.match(await verifyDownload(dl.file, `${RELEASE}/${asset}`, 'darwin', missingFile.fetchImpl) ?? '', /Could not download .* checksums \(404\)/);
    const offline = fakeFetch(null);
    assert.match(await verifyDownload(dl.file, `${RELEASE}/${asset}`, 'darwin', offline.fetchImpl) ?? '', /Could not download .* checksums/);
  } finally {
    dl.cleanup();
  }
});

test('a Windows download is checked against the release\'s Windows checksum file', async () => {
  const dl = download('the real installer');
  try {
    for (const asset of ['Unvibe-0.1.45-win-x64-setup.exe', 'Unvibe-0.1.45-win-x64-portable.exe']) {
      // sha256sum's binary-mode marker (`*name`) is accepted too.
      const good = fakeFetch(`${'0'.repeat(64)}  Unvibe-0.1.45-mac-arm64.dmg\n${dl.sha} *${asset}\n`);
      assert.equal(await verifyDownload(dl.file, `${RELEASE}/${asset}`, 'win32', good.fetchImpl), null);
      assert.deepEqual(good.urls, [`${RELEASE}/SHA256SUMS-windows.txt`], 'Windows uses its own checksum file from the same tag');
      const bad = fakeFetch(`${'e'.repeat(64)}  ${asset}\n`);
      assert.match(await verifyDownload(dl.file, `${RELEASE}/${asset}`, 'win32', bad.fetchImpl) ?? '', /does not match its published checksum/);
    }
  } finally {
    dl.cleanup();
  }
});
