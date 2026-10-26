import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAC_SIGNING_REQUIREMENT, macUpdateScript, prepareUpdate, verifyDownload } from '../src/main/updater';

/**
 * The release's designated requirement, written out on purpose instead of imported. It must equal
 * BETA_MAC_SIGNING_REQUIREMENT in marketing/src/lib/betaInstallScript.ts, whose test pins the same
 * literal: if either copy is weakened or changed, a test fails instead of following it.
 */
const PINNED_REQUIREMENT = 'identifier "com.unvibe.app" and certificate leaf = H"c9da4f618adf98911a450e041b8f336574a99d0e"';

const RELEASE = 'https://github.com/ShadowEsu/Unvibe/releases/download/v0.1.45';

test('the macOS helper verifies the mounted app with the pinned requirement before touching the installed app, and never re-signs', () => {
  assert.equal(MAC_SIGNING_REQUIREMENT, PINNED_REQUIREMENT, 'the app pins the same requirement as install.sh');
  const script = macUpdateScript({ pid: 4242, file: '/w/Unvibe.dmg', dir: '/w', mount: '/w/mnt', target: '/Applications/Unvibe.app', version: '0.1.45' });
  const verify = script.indexOf(`codesign --verify --deep --strict -R='${PINNED_REQUIREMENT}' '/w/mnt/Unvibe.app'`);
  const remove = script.indexOf(`rm -rf '/Applications/Unvibe.app'`);
  assert.ok(verify >= 0, 'the mounted app is checked against the pinned requirement');
  assert.ok(remove >= 0);
  assert.ok(verify < remove, 'the pinned verify comes before rm -rf of the installed app');
  assert.ok(script.indexOf('ditto ') > verify, 'nothing is copied before the check');
  assert.doesNotMatch(script, /--sign/, 'the helper never re-signs');
});

test('the macOS helper only installs the version the update is for, checked after the signature and before rm', () => {
  const script = macUpdateScript({ pid: 4242, file: '/w/Unvibe.dmg', dir: '/w', mount: '/w/mnt', target: '/Applications/Unvibe.app', version: '0.1.45' });
  const verify = script.indexOf(`codesign --verify --deep --strict -R='${PINNED_REQUIREMENT}' '/w/mnt/Unvibe.app'`);
  const version = script.indexOf(`[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' '/w/mnt/Unvibe.app/Contents/Info.plist' 2>/dev/null)" = '0.1.45' ]`);
  const remove = script.indexOf(`rm -rf '/Applications/Unvibe.app'`);
  assert.ok(version > verify && verify >= 0 && version < remove, 'the mounted app\'s version must equal the release version, checked after the pinned codesign and before rm');
});

test('the macOS helper copies the app beside the installed one and checks the copy again before swapping it in', () => {
  const script = macUpdateScript({ pid: 4242, file: '/w/Unvibe.dmg', dir: '/w', mount: '/w/mnt', target: '/Applications/Unvibe.app', version: '0.1.45' });
  const mountVersion = script.indexOf(`[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' '/w/mnt/Unvibe.app/Contents/Info.plist' 2>/dev/null)" = '0.1.45' ] || refuse`);
  const copy = script.indexOf(`ditto --noacl --noextattr --norsrc '/w/mnt/Unvibe.app' '/Applications/Unvibe.app.new' || refuse`);
  const permissions = script.indexOf(`chmod -R u+rwX,go-w '/Applications/Unvibe.app.new' || refuse`);
  const stagedVerify = script.indexOf(`codesign --verify --deep --strict -R='${PINNED_REQUIREMENT}' '/Applications/Unvibe.app.new' >/dev/null 2>&1 || refuse`);
  const stagedVersion = script.indexOf(`[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' '/Applications/Unvibe.app.new/Contents/Info.plist' 2>/dev/null)" = '0.1.45' ] || refuse`);
  const swap = script.indexOf(`rm -rf '/Applications/Unvibe.app' && mv '/Applications/Unvibe.app.new' '/Applications/Unvibe.app' || refuse`);
  assert.ok(mountVersion >= 0 && copy > mountVersion, 'the mounted app passes both checks before it is copied, without ACLs, extended attributes or resource forks');
  assert.ok(permissions > copy && stagedVerify > permissions, 'only the owner can write to the copy, and that is set before it is checked');
  assert.ok(stagedVersion > stagedVerify, 'the staged copy is checked with the pin and the version');
  assert.ok(swap > stagedVersion, 'the staged copy passes its checks before it replaces the installed app');
});

/**
 * Runs the generated helper with every command that could change the machine replaced by a stub
 * that logs its arguments. The installed app is a folder with a marker file in a scratch directory.
 * With `mountedApp: 'symlink'`, the image's Unvibe.app is a symlink to a bundle elsewhere. The image's
 * app reports `mountedVersion`; the helper is generated for 0.1.45. PlistBuddy is called by its full
 * path, so the script's /usr/libexec/PlistBuddy is pointed at a stub that prints the version file.
 */
function runHelper(opts: { codesignFails?: 'mount' | 'staged'; dittoFails?: boolean; mountedApp?: 'folder' | 'symlink'; mountedVersion?: string } = {}) {
  const { codesignFails = '', dittoFails = false, mountedApp = 'folder', mountedVersion = '0.1.45' } = opts;
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
  if [ "$MOUNTED_APP" = symlink ]; then
    app="$ELSEWHERE"; ln -s "$ELSEWHERE" "$mp/Unvibe.app"
  else
    app="$mp/Unvibe.app"
  fi
  mkdir -p "$app/Contents"; echo NEW > "$app/marker"; chmod 666 "$app/marker"; echo "$MOUNTED_VERSION" > "$app/Contents/Info.plist"
fi
exit 0`,
    codesign: `echo "codesign $*" >> "$LOG"
for a in "$@"; do app="$a"; done
case "$app" in *.new) [ "$CODESIGN_FAILS" = staged ] && exit 1 ;; *) [ "$CODESIGN_FAILS" = mount ] && exit 1 ;; esac
exit 0`,
    PlistBuddy: 'echo "PlistBuddy $*" >> "$LOG"; for a in "$@"; do f="$a"; done; exec cat "$f"',
    open: 'echo "open $*" >> "$LOG"; exit 0',
    ditto: `echo "ditto $*" >> "$LOG"
for a in "$@"; do src="$dst"; dst="$a"; done
if [ "$DITTO_FAILS" = 1 ]; then mkdir -p "$dst"; exit 1; fi
exec cp -Rp "$src" "$dst"`,
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
  const generated = macUpdateScript({ pid, file: path.join(dir, 'Unvibe.dmg'), dir, mount: path.join(dir, 'mnt'), target, version: '0.1.45' });
  writeFileSync(script, generated.replaceAll('/usr/libexec/PlistBuddy', path.join(bin, 'PlistBuddy')));
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    LOG: log,
    CODESIGN_FAILS: codesignFails,
    DITTO_FAILS: dittoFails ? '1' : '',
    MOUNTED_APP: mountedApp,
    MOUNTED_VERSION: mountedVersion,
    ELSEWHERE: path.join(root, 'elsewhere', 'Unvibe.app'),
  };
  const result = spawnSync('/bin/bash', [script], { env, encoding: 'utf8' });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  const marker = readFileSync(path.join(target, 'marker'), 'utf8').trim();
  const markerMode = statSync(path.join(target, 'marker')).mode;
  const stagedLeft = existsSync(`${target}.new`);
  rmSync(root, { recursive: true, force: true });
  return { status: result.status, calls, marker, markerMode, stagedLeft, target, dir };
}

test('a mounted app that fails the signature check leaves the installed app untouched and reopens it', { skip: process.platform === 'win32' }, () => {
  const run = runHelper({ codesignFails: 'mount' });
  assert.equal(run.marker, 'OLD', 'the installed app is untouched');
  assert.ok(run.calls.includes(`open ${run.target}`), 'the old app is opened again');
  assert.equal(run.status, 1, 'the stop is reported like the helper\'s other failures (exit 1)');
  assert.ok(!run.calls.some((c) => c.startsWith('ditto')), 'nothing is copied in');
  assert.ok(run.calls.some((c) => c.startsWith('hdiutil detach')), 'the image is detached');

  const ok = runHelper();
  assert.equal(ok.marker, 'NEW', 'a build that passes replaces the installed app');
  assert.equal(ok.status, 0);
  assert.ok(ok.calls.includes(`codesign --verify --deep --strict -R=${PINNED_REQUIREMENT} ${ok.dir}/mnt/Unvibe.app`), 'the mounted app, not the installed one, is verified');
  assert.ok(ok.calls.includes(`PlistBuddy -c Print :CFBundleShortVersionString ${ok.dir}/mnt/Unvibe.app/Contents/Info.plist`), 'the mounted app\'s version is read');
  assert.ok(ok.calls.includes(`open ${ok.target}`));
  const mountVerify = ok.calls.indexOf(`codesign --verify --deep --strict -R=${PINNED_REQUIREMENT} ${ok.dir}/mnt/Unvibe.app`);
  const copy = ok.calls.findIndex((c) => c.startsWith('ditto'));
  const stagedVerify = ok.calls.indexOf(`codesign --verify --deep --strict -R=${PINNED_REQUIREMENT} ${ok.target}.new`);
  assert.ok(mountVerify < copy && copy < stagedVerify, 'the copy is verified again after it is made');
  assert.ok(ok.calls.includes(`PlistBuddy -c Print :CFBundleShortVersionString ${ok.target}.new/Contents/Info.plist`), 'the copy\'s version is read');
  assert.ok(!ok.stagedLeft, 'the staged copy was moved into place');
  assert.equal(ok.markerMode & 0o022, 0, 'a file writable by anyone in the image is writable only by its owner once installed');
});

test('a staged copy that fails its check, or a failed copy, keeps the installed app and leaves no .new', { skip: process.platform === 'win32' }, () => {
  for (const [label, run] of [['the copy fails the pin', runHelper({ codesignFails: 'staged' })], ['ditto fails', runHelper({ dittoFails: true })]] as const) {
    assert.equal(run.status, 1, `${label}: exit 1`);
    assert.equal(run.marker, 'OLD', `${label}: the installed app is kept`);
    assert.ok(!run.stagedLeft, `${label}: no .new is left behind`);
    assert.ok(run.calls.includes(`open ${run.target}`), `${label}: the old app is opened again`);
  }
});

test('a validly signed app of another version is refused and the installed app is untouched', { skip: process.platform === 'win32' }, () => {
  // codesign passes (exit 0): an older release carries the same signature.
  const run = runHelper({ mountedVersion: '0.1.44' });
  assert.equal(run.status, 1, 'a version other than the release\'s is refused (exit 1)');
  assert.equal(run.marker, 'OLD', 'the installed app is untouched');
  assert.ok(run.calls.includes(`open ${run.target}`), 'the old app is opened again');
  assert.ok(!run.calls.some((c) => c.startsWith('ditto')), 'nothing is copied in');
});

test('a symlinked Unvibe.app in the image is refused, even when what it points at is validly signed', { skip: process.platform === 'win32' }, () => {
  // codesign passes (exit 0): the link points at a correctly signed bundle somewhere else.
  const run = runHelper({ mountedApp: 'symlink' });
  assert.equal(run.marker, 'OLD', 'a symlinked Unvibe.app leaves the installed app untouched');
  assert.ok(run.calls.includes(`open ${run.target}`), 'the old app is opened again');
  assert.equal(run.status, 1);
  assert.ok(!run.calls.some((c) => c.startsWith('ditto')), 'nothing is copied in');
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

/** A release that serves `installer` as the asset, and `sums(sha of installer)` as its checksum file. */
function fakeRelease(installer: string, sums: (sha: string) => string) {
  const urls: string[] = [];
  const sha = createHash('sha256').update(installer).digest('hex');
  const fetchImpl = async (url: string): Promise<Response> => {
    urls.push(url);
    return new Response(/\/SHA256SUMS-[a-z]+\.txt$/.test(url) ? sums(sha) : installer);
  };
  return { urls, fetchImpl };
}

test('a macOS update that fails its checksum writes no helper and deletes its download folder', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-updater-test-'));
  const asset = 'Unvibe-0.1.45-mac-arm64.dmg';
  const info = { available: true, current: '0.1.44', latest: '0.1.45', url: `${RELEASE}/${asset}` };
  const opts = { platform: 'darwin' as const, pid: 4242, macTarget: '/Applications/Unvibe.app', workRoot: root };
  try {
    const bad = fakeRelease('a tampered disk image', () => `${'f'.repeat(64)}  ${asset}\n`);
    const refused = await prepareUpdate(info, { ...opts, fetchImpl: bad.fetchImpl });
    assert.ok(!refused.ok, 'a download that fails its checksum is refused');
    assert.match(refused.error, /does not match its published checksum/);
    assert.deepEqual(readdirSync(root), [], 'no update.sh is written and the download folder is deleted');

    const good = fakeRelease('the real disk image', (sha) => `${sha}  ${asset}\n`);
    const ready = await prepareUpdate(info, { ...opts, fetchImpl: good.fetchImpl });
    assert.ok(ready.ok && ready.script, 'a download that matches gets a helper');
    assert.deepEqual(good.urls, [`${RELEASE}/${asset}`, `${RELEASE}/SHA256SUMS-mac.txt`]);
    const script = readFileSync(ready.script, 'utf8');
    assert.ok(script.includes(`2>/dev/null)" = '0.1.45' ]`) && !script.includes(`'0.1.44'`), 'the helper is bound to the release being installed, not the running version');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a portable update that fails its checksum deletes only the download beside the .exe', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-updater-test-'));
  const exe = path.join(root, 'Unvibe.exe');
  writeFileSync(exe, 'OLD EXE');
  const asset = 'Unvibe-0.1.45-win-x64-portable.exe';
  const info = { available: true, current: '0.1.44', latest: '0.1.45', url: `${RELEASE}/${asset}` };
  try {
    const bad = fakeRelease('a tampered exe', () => `${'e'.repeat(64)}  ${asset}\n`);
    const refused = await prepareUpdate(info, { platform: 'win32', fetchImpl: bad.fetchImpl, pid: 4242, portable: exe });
    assert.ok(!refused.ok, 'a download that fails its checksum is refused');
    assert.match(refused.error, /does not match its published checksum/);
    assert.deepEqual(readdirSync(root), ['Unvibe.exe'], 'only the .download is deleted, never the folder the .exe is in');
    assert.equal(readFileSync(exe, 'utf8'), 'OLD EXE', 'the running .exe is untouched');

    const good = fakeRelease('the real exe', (sha) => `${sha}  ${asset}\n`);
    const ready = await prepareUpdate(info, { platform: 'win32', fetchImpl: good.fetchImpl, pid: 4242, portable: exe });
    assert.ok(ready.ok && ready.file === `${exe}.download` && !ready.script, 'a portable download that matches is kept beside the .exe');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a download that cannot be checked is refused and deleted', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-updater-test-'));
  // A malformed escape in the asset name makes the check itself throw (decodeURIComponent).
  const info = { available: true, current: '0.1.44', latest: '0.1.45', url: `${RELEASE}/Unvibe-%E0%A4%A.dmg` };
  try {
    const release = fakeRelease('a disk image', (sha) => `${sha}  Unvibe-0.1.45-mac-arm64.dmg\n`);
    const refused = await prepareUpdate(info, { platform: 'darwin', fetchImpl: release.fetchImpl, pid: 4242, workRoot: root });
    assert.ok(!refused.ok, 'a check that throws is a refusal');
    assert.match(refused.error, /Could not check the download/);
    assert.deepEqual(readdirSync(root), [], 'the download folder is deleted');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an app running from App Translocation is told to move to Applications, before anything is downloaded', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-updater-test-'));
  const info = { available: true, current: '0.1.44', latest: '0.1.45', url: `${RELEASE}/Unvibe-0.1.45-mac-arm64.dmg` };
  try {
    const release = fakeRelease('the real disk image', (sha) => `${sha}  Unvibe-0.1.45-mac-arm64.dmg\n`);
    const macTarget = '/private/var/folders/xy/abc/T/AppTranslocation/0A1B2C3D-4E5F/d/Unvibe.app';
    const refused = await prepareUpdate(info, { platform: 'darwin', fetchImpl: release.fetchImpl, pid: 4242, macTarget, workRoot: root });
    assert.ok(!refused.ok);
    assert.equal(refused.error, 'Move Unvibe to your Applications folder first, then update.', 'a translocated app is refused with a way out');
    assert.deepEqual(release.urls, [], 'nothing is downloaded');
    assert.deepEqual(readdirSync(root), [], 'no download folder is created');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('release addresses are checked as parsed, so dot segments cannot leave the repository', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-updater-test-'));
  const dl = download('a disk image');
  try {
    for (const url of [`${RELEASE}/../../../../../evil/Unvibe/releases/download/v9/Unvibe.dmg`, `${RELEASE}/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/evil/Unvibe.dmg`]) {
      assert.match(url, /^https:\/\/github\.com\/ShadowEsu\/Unvibe\/releases\/download\//, 'the raw string looks like a release asset');
      const release = fakeRelease('a disk image', (sha) => `${sha}  Unvibe.dmg\n`);
      const info = { available: true, current: '0.1.44', latest: '0.1.45', url };
      const refused = await prepareUpdate(info, { platform: 'darwin', fetchImpl: release.fetchImpl, pid: 4242, workRoot: root });
      assert.ok(!refused.ok);
      assert.match(refused.error, /unexpected address/, 'the asset address is checked after parsing');
      const sums = fakeFetch(`${dl.sha}  Unvibe.dmg\n`);
      assert.match(await verifyDownload(dl.file, url, 'darwin', sums.fetchImpl) ?? '', /unexpected address/, 'the checksum file address is checked after parsing');
      assert.deepEqual([...release.urls, ...sums.urls], [], 'nothing is fetched');
    }
    assert.deepEqual(readdirSync(root), [], 'no download folder is created');
  } finally {
    dl.cleanup();
    rmSync(root, { recursive: true, force: true });
  }
});
