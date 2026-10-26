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
  const moveAside = script.indexOf(`mv '/Applications/Unvibe.app' '/Applications/Unvibe.app.old'`);
  assert.ok(verify >= 0, 'the mounted app is checked against the pinned requirement');
  assert.ok(moveAside >= 0, 'the installed app is moved aside, not deleted');
  assert.ok(verify < moveAside, 'the pinned verify comes before the installed app is moved aside');
  assert.ok(script.indexOf('ditto ') > verify, 'nothing is copied before the check');
  assert.doesNotMatch(script, /--sign/, 'the helper never re-signs');
});

test('the release workflow checks the same pin as the app: the certificate before packaging, the built installers after', () => {
  // dist-test/ sits in app/, so the repository root is two folders up.
  const workflow = readFileSync(path.resolve(__dirname, '..', '..', '.github', 'workflows', 'app-release.yml'), 'utf8');
  assert.ok(workflow.includes(`codesign --verify --deep --strict --verbose=2 -R='${MAC_SIGNING_REQUIREMENT}' "$app"`), 'the built installers are verified with the app\'s requirement');
  const leaf = /certificate leaf = H"([0-9a-f]{40})"/.exec(MAC_SIGNING_REQUIREMENT)?.[1];
  assert.ok(leaf && workflow.includes(`if [ "$leaf" != "${leaf}" ]; then`), 'the signing certificate is checked against the pinned leaf before packaging');
});

test('a Mac release with a Developer ID configured stops before packaging', () => {
  const workflow = readFileSync(path.resolve(__dirname, '..', '..', '.github', 'workflows', 'app-release.yml'), 'utf8');
  const prepare = workflow.slice(workflow.indexOf('- name: Prepare stable Mac signing identity'), workflow.indexOf('- name: Build app bundle'));
  assert.ok(prepare.includes('MAC_CSC_LINK: ${{ secrets.MAC_CSC_LINK }}'), 'the step sees whether a Developer ID is configured');
  assert.match(prepare, /if \[ "\$PUBLISH" = "true" \] && \[ -n "\$MAC_CSC_LINK" \]; then\n\s+echo "[^"\n]+"\n\s+exit 1\n/, 'publishing with MAC_CSC_LINK set exits 1');
});

test('only a publishing run imports the signing identity', () => {
  const workflow = readFileSync(path.resolve(__dirname, '..', '..', '.github', 'workflows', 'app-release.yml'), 'utf8');
  const prepare = workflow.slice(workflow.indexOf('- name: Prepare stable Mac signing identity'), workflow.indexOf('- name: Build app bundle'));
  const notPublishing = /if \[ "\$PUBLISH" != "true" \]; then\n\s+echo "[^"\n]+"\n\s+exit 0\n/.exec(prepare);
  const firstUse = prepare.search(/base64 --decode|security import/);
  assert.ok(notPublishing && firstUse > notPublishing.index, 'a run that does not publish stops before the identity is decoded or imported');
});

test('the packaging hook checks the pinned requirement when the stable identity signs, before anything is uploaded', { skip: process.platform === 'win32' }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-afterpack-test-'));
  const bin = path.join(root, 'bin');
  const log = path.join(root, 'codesign.log');
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'codesign'), `#!/bin/bash\nprintf '%s\\n' "$*" >> '${log}'\n`);
  chmodSync(path.join(bin, 'codesign'), 0o755);
  // dist-test/ sits in app/, beside scripts/.
  const afterPack = require(path.resolve(__dirname, '..', 'scripts', 'afterPackHook.cjs')) as (context: unknown) => Promise<void>;
  const context = { electronPlatformName: 'darwin', appOutDir: root, packager: { appInfo: { productFilename: 'Unvibe' }, projectDir: root } };
  const app = path.join(root, 'Unvibe.app');
  const names = ['PATH', 'UNVIBE_SIGN_IDENTITY', 'UNVIBE_SIGN_KEYCHAIN', 'CSC_LINK', 'CSC_NAME'] as const;
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    process.env.PATH = `${bin}:${saved.PATH}`;
    process.env.UNVIBE_SIGN_IDENTITY = 'Unvibe Self Signed';
    await afterPack(context);
    delete process.env.UNVIBE_SIGN_IDENTITY;
    await afterPack(context);
    const verifies = readFileSync(log, 'utf8').trim().split('\n').filter((call) => call.startsWith('--verify'));
    assert.deepEqual(verifies, [
      `--verify --deep --strict --verbose=2 -R=${PINNED_REQUIREMENT} ${app}`,
      `--verify --deep --strict --verbose=2 ${app}`,
    ], 'the stable identity is checked against the pin; an ad-hoc build is checked without it');
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test('the macOS helper only installs the version the update is for, checked after the signature and before the installed app is touched', () => {
  const script = macUpdateScript({ pid: 4242, file: '/w/Unvibe.dmg', dir: '/w', mount: '/w/mnt', target: '/Applications/Unvibe.app', version: '0.1.45' });
  const verify = script.indexOf(`codesign --verify --deep --strict -R='${PINNED_REQUIREMENT}' '/w/mnt/Unvibe.app'`);
  const version = script.indexOf(`[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' '/w/mnt/Unvibe.app/Contents/Info.plist' 2>/dev/null)" = '0.1.45' ]`);
  const moveAside = script.indexOf(`mv '/Applications/Unvibe.app' '/Applications/Unvibe.app.old'`);
  assert.ok(version > verify && verify >= 0 && version < moveAside, 'the mounted app\'s version must equal the release version, checked after the pinned codesign and before the installed app is moved aside');
});

test('the macOS helper copies the app beside the installed one and checks the copy again before swapping it in', () => {
  const script = macUpdateScript({ pid: 4242, file: '/w/Unvibe.dmg', dir: '/w', mount: '/w/mnt', target: '/Applications/Unvibe.app', version: '0.1.45' });
  const mountVersion = script.indexOf(`[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' '/w/mnt/Unvibe.app/Contents/Info.plist' 2>/dev/null)" = '0.1.45' ] || refuse`);
  const copy = script.indexOf(`ditto --noacl --noextattr --norsrc '/w/mnt/Unvibe.app' '/Applications/Unvibe.app.new' || refuse`);
  const permissions = script.indexOf(`chmod -R u+rwX,go-w '/Applications/Unvibe.app.new' || refuse`);
  const stagedVerify = script.indexOf(`codesign --verify --deep --strict -R='${PINNED_REQUIREMENT}' '/Applications/Unvibe.app.new' >/dev/null 2>&1 || refuse`);
  const stagedVersion = script.indexOf(`[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' '/Applications/Unvibe.app.new/Contents/Info.plist' 2>/dev/null)" = '0.1.45' ] || refuse`);
  const moveAside = script.indexOf(`if [ -e '/Applications/Unvibe.app' ] || [ -L '/Applications/Unvibe.app' ]; then mv '/Applications/Unvibe.app' '/Applications/Unvibe.app.old' || refuse; fi`);
  const moveIn = script.indexOf(`mv '/Applications/Unvibe.app.new' '/Applications/Unvibe.app' || { if [ -e '/Applications/Unvibe.app.old' ] || [ -L '/Applications/Unvibe.app.old' ]; then mv '/Applications/Unvibe.app.old' '/Applications/Unvibe.app'; fi; refuse; }`);
  const removeOld = script.lastIndexOf(`rm -rf '/Applications/Unvibe.app.old' 2>/dev/null`);
  assert.ok(mountVersion >= 0 && copy > mountVersion, 'the mounted app passes both checks before it is copied, without ACLs, extended attributes or resource forks');
  assert.ok(permissions > copy && stagedVerify > permissions, 'only the owner can write to the copy, and that is set before it is checked');
  assert.ok(stagedVersion > stagedVerify, 'the staged copy is checked with the pin and the version');
  assert.ok(moveAside > stagedVersion, 'the staged copy passes its checks before the installed app is moved aside');
  assert.ok(moveIn > moveAside && removeOld > moveIn, 'the old app is deleted only after the new one is in place, and moved back if it can\'t be');
});

/**
 * Runs the generated helper with every command that could change the machine replaced by a stub
 * that logs its arguments. The installed app is a folder with a marker file in a scratch directory.
 * With `mountedApp: 'symlink'`, the image's Unvibe.app is a symlink to a bundle elsewhere. The image's
 * app reports `mountedVersion`; the helper is generated for 0.1.45. PlistBuddy is called by its full
 * path, so the script's /usr/libexec/PlistBuddy is pointed at a stub that prints the version file.
 * `installed: 'locked'` gives the installed app a read-only folder with a file in it, which rm can't
 * fully delete; `'none'` means there is no installed app yet. `newMoveFails` makes `mv` fail when it
 * moves the `.new` copy.
 */
function runHelper(opts: { codesignFails?: 'mount' | 'staged'; dittoFails?: boolean; mountedApp?: 'folder' | 'symlink'; mountedVersion?: string; installed?: 'app' | 'locked' | 'none'; newMoveFails?: boolean } = {}) {
  const { codesignFails = '', dittoFails = false, mountedApp = 'folder', mountedVersion = '0.1.45', installed = 'app', newMoveFails = false } = opts;
  const root = mkdtempSync(path.join(tmpdir(), 'unvibe-updater-test-'));
  const bin = path.join(root, 'bin');
  const dir = path.join(root, 'work');
  const target = path.join(root, 'installed', 'Unvibe.app');
  const log = path.join(root, 'calls.log');
  mkdirSync(bin);
  mkdirSync(dir);
  mkdirSync(path.dirname(target));
  if (installed !== 'none') {
    mkdirSync(path.join(target, 'Contents', 'Resources', 'locked'), { recursive: true });
    writeFileSync(path.join(target, 'marker'), 'OLD');
    writeFileSync(path.join(target, 'Contents', 'Resources', 'locked', 'file'), 'OLD RESOURCE');
    if (installed === 'locked') chmodSync(path.join(target, 'Contents', 'Resources', 'locked'), 0o555);
  }
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
    mv: `echo "mv $*" >> "$LOG"
case "$1" in *.new) [ "$MV_NEW_FAILS" = 1 ] && exit 1 ;; esac
exec /bin/mv "$@"`,
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
    MV_NEW_FAILS: newMoveFails ? '1' : '',
    MOUNTED_APP: mountedApp,
    MOUNTED_VERSION: mountedVersion,
    ELSEWHERE: path.join(root, 'elsewhere', 'Unvibe.app'),
  };
  const result = spawnSync('/bin/bash', [script], { env, encoding: 'utf8' });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  const read = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8').trim() : '(missing)');
  const marker = read(path.join(target, 'marker'));
  const markerMode = existsSync(path.join(target, 'marker')) ? statSync(path.join(target, 'marker')).mode : 0;
  const installedVersion = read(path.join(target, 'Contents', 'Info.plist'));
  const oldResource = read(path.join(target, 'Contents', 'Resources', 'locked', 'file'));
  const stagedLeft = existsSync(`${target}.new`);
  // The read-only folder has to be writable again before the scratch directory can be removed.
  spawnSync('chmod', ['-R', 'u+w', root]);
  rmSync(root, { recursive: true, force: true });
  return { status: result.status, calls, marker, markerMode, installedVersion, oldResource, stagedLeft, target, dir };
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

test('an old app that rm cannot fully delete does not stop the new version from being installed', { skip: process.platform === 'win32' }, () => {
  const run = runHelper({ installed: 'locked' });
  assert.equal(run.status, 0, 'a leftover .old does not fail the update');
  assert.equal(run.installedVersion, '0.1.45', 'the new version is installed');
  assert.equal(run.marker, 'NEW');
  assert.ok(!run.stagedLeft, 'the staged copy was moved into place');
  assert.ok(run.calls.includes(`open ${run.target}`), 'the new app is opened');
});

test('if the new app cannot be moved into place, the old app is moved back intact', { skip: process.platform === 'win32' }, () => {
  const run = runHelper({ newMoveFails: true });
  assert.equal(run.status, 1, 'the failed swap exits 1');
  assert.equal(run.marker, 'OLD', 'the old app is back at the target');
  assert.equal(run.oldResource, 'OLD RESOURCE', 'the old app is intact, nested files included');
  assert.ok(!run.stagedLeft, 'no .new is left behind');
  assert.ok(run.calls.includes(`open ${run.target}`), 'the old app is opened again');
});

test('an app with no installed copy at the target is installed there', { skip: process.platform === 'win32' }, () => {
  const run = runHelper({ installed: 'none' });
  assert.equal(run.status, 0, 'a target that does not exist yet is not a failure');
  assert.equal(run.installedVersion, '0.1.45', 'the new version is installed at the target');
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
    assert.ok(!refused.ok, 'a translocated app is refused before anything is downloaded');
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
      assert.ok(!refused.ok, 'an address that leaves the releases folder once parsed is refused');
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
