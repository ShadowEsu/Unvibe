import { app } from 'electron';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { networkFetch } from './backend';
import { isNewer, pickAsset } from '../core/update';

export { isNewer, pickAsset };

/**
 * Self-update from the public GitHub releases. On request it downloads the right installer, checks
 * it against the SHA-256 published in the same release, quits, swaps the app in place and reopens
 * it. Only release assets from this repository are ever downloaded. On macOS the new app must also
 * pass MAC_SIGNING_REQUIREMENT before the installed one is touched; nothing is ever re-signed.
 */

const REPO = 'ShadowEsu/Unvibe';
const ASSET_HOST = /^https:\/\/github\.com\/ShadowEsu\/Unvibe\/releases\/download\//;

/**
 * The signature a macOS update must carry: the release's self-signed certificate ("Unvibe Self
 * Signed") and bundle id. A copy re-signed by anyone else fails. Same value as
 * BETA_MAC_SIGNING_REQUIREMENT in marketing/src/lib/betaInstallScript.ts (install.sh) and as the
 * release build's check in scripts/afterPackHook.cjs; the tests pin the literal, so the copies
 * can't drift apart unnoticed.
 */
export const MAC_SIGNING_REQUIREMENT =
  'identifier "com.unvibe.app" and certificate leaf = H"c9da4f618adf98911a450e041b8f336574a99d0e"';

/** The checksum file app-release.yml publishes next to each platform's installers. */
export function checksumAssetName(platform: NodeJS.Platform): string | undefined {
  if (platform === 'darwin') return 'SHA256SUMS-mac.txt';
  if (platform === 'win32') return 'SHA256SUMS-windows.txt';
  return undefined;
}

/** The SHA-256 a checksum file lists for one asset (`<hex>  <name>` or `<hex> *<name>` lines). */
export function expectedSha256(sums: string, assetName: string): string | undefined {
  for (const line of sums.split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (match && match[2] === assetName) return match[1].toLowerCase();
  }
  return undefined;
}

async function sha256File(file: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Checks a downloaded installer against the checksum file of the same release (same tag, same
 * folder as the asset). Returns why it can't be installed, or null when it matches. No checksum,
 * no install.
 */
export async function verifyDownload(file: string, assetUrl: string, platform: NodeJS.Platform, fetchImpl: Fetch = networkFetch): Promise<string | null> {
  const sumsName = checksumAssetName(platform);
  if (!sumsName) return 'Automatic updates are not available on this system.';
  // Checked as parsed (`href`), not as written: dot segments like `/download/../../` can leave the
  // repository's releases while the raw string still matches.
  const asset = new URL(assetUrl);
  const sumsUrl = new URL(sumsName, asset).href;
  if (!ASSET_HOST.test(asset.href) || !ASSET_HOST.test(sumsUrl)) return 'Refusing to download an update from an unexpected address.';
  const assetName = decodeURIComponent(path.posix.basename(asset.pathname));
  const unchanged = 'The update was not installed, and your Unvibe is unchanged.';
  let sums: string;
  try {
    const res = await fetchImpl(sumsUrl, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return `Could not download the update's published checksums (${res.status}). ${unchanged}`;
    sums = await res.text();
  } catch (error) {
    return `Could not download the update's published checksums (${error instanceof Error ? error.message : String(error)}). ${unchanged}`;
  }
  const expected = expectedSha256(sums, assetName);
  if (!expected) return `The published checksums have no line for ${assetName}. ${unchanged}`;
  if ((await sha256File(file)) !== expected) return `The download does not match its published checksum. ${unchanged}`;
  return null;
}

export interface UpdateInfo {
  available: boolean;
  current: string;
  latest?: string;
  url?: string;
  notesUrl?: string;
}

let cached: { at: number; info: UpdateInfo } | null = null;

/** Set by electron-builder's portable launcher to the .exe the user actually runs. */
function portableExecutable(): string | undefined {
  return process.platform === 'win32' ? process.env.PORTABLE_EXECUTABLE_FILE || undefined : undefined;
}

/** After a portable self-update, remove the previous .exe that was moved aside. */
export function cleanupPortableUpdate(): void {
  const portable = portableExecutable();
  if (portable) void rm(`${portable}.old`, { force: true }).catch(() => undefined);
}

export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const current = app.getVersion();
  if (!force && cached && Date.now() - cached.at < 30 * 60_000) return cached.info;
  const res = await networkFetch(`https://api.github.com/repos/${REPO}/releases?per_page=8`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Unvibe/${current}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Update check failed (${res.status}).`);
  const releases = (await res.json()) as Array<{ tag_name: string; draft: boolean; html_url: string; assets: Array<{ name: string; browser_download_url: string }> }>;
  for (const release of releases) {
    if (release.draft) continue;
    const name = pickAsset(release.assets.map((a) => a.name), process.platform, process.arch, Boolean(portableExecutable()));
    const asset = release.assets.find((a) => a.name === name);
    if (!asset) continue;
    const latest = release.tag_name.replace(/^v/, '');
    const info: UpdateInfo = isNewer(latest, current)
      ? { available: true, current, latest, url: asset.browser_download_url, notesUrl: release.html_url }
      : { available: false, current, latest };
    cached = { at: Date.now(), info };
    return info;
  }
  const info: UpdateInfo = { available: false, current };
  cached = { at: Date.now(), info };
  return info;
}

/** Path of the running .app bundle on macOS (…/Unvibe.app). */
function macBundlePath(): string {
  return path.resolve(process.execPath, '..', '..', '..');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The helper that swaps the app after Unvibe quits. The mounted app must pass the pinned signature
 * check before anything is copied. It is then copied beside the installed app (`<target>.new`), and
 * that copy must pass the same checks before it replaces the installed app, so nothing changes
 * between the check and the swap. The installed app is not deleted to make room: it is moved aside
 * to `<target>.old`, the new app is moved into its place, and only then is the old one deleted. If
 * the new app can't be moved in, the old one is moved back. On any failure the installed app stays
 * as it is, the copy is removed, the old app is reopened, and the script exits 1. A leftover `.old`
 * that can't be deleted doesn't fail the update. It never re-signs: a re-signed copy would run
 * with a different identity, and macOS drops the Accessibility permission for it.
 * The copy takes no ACLs, extended attributes (quarantine included) or resource forks, which the
 * signature doesn't seal, and only its owner can write to it. Unvibe.app in the image must be a
 * real folder, not a symlink: a link to a validly signed bundle elsewhere (even the installed app
 * itself) would pass codesign and then be copied in. The signed app must also be the version this
 * update is for (`version`, the release tag): an older build carries the same signature, so without
 * this a release could roll users back to an updater without these checks. Info.plist is sealed by
 * the signature, so once codesign passes its version can be trusted.
 */
export function macUpdateScript(opts: { pid: number; file: string; dir: string; mount: string; target: string; version: string }): string {
  const { pid, file, dir, mount, target, version } = opts;
  const mounted = shellQuote(`${mount}/Unvibe.app`);
  const staged = shellQuote(`${target}.new`);
  const installed = shellQuote(target);
  const old = shellQuote(`${target}.old`);
  const pin = shellQuote(MAC_SIGNING_REQUIREMENT);
  const wanted = shellQuote(version);
  const readVersion = `/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString'`;
  return [
    '#!/bin/bash',
    `while kill -0 ${pid} 2>/dev/null; do sleep 0.3; done`,
    'refuse() {',
    `  rm -rf ${staged}`,
    `  hdiutil detach ${shellQuote(mount)} -force >/dev/null 2>&1`,
    `  open ${installed}`,
    `  rm -rf ${shellQuote(dir)}`,
    '  exit 1',
    '}',
    `mkdir -p ${shellQuote(mount)}`,
    `hdiutil attach -nobrowse -readonly -mountpoint ${shellQuote(mount)} ${shellQuote(file)} >/dev/null || refuse`,
    `[ -d ${mounted} ] && [ ! -L ${mounted} ] || refuse`,
    `codesign --verify --deep --strict -R=${pin} ${mounted} >/dev/null 2>&1 || refuse`,
    `[ "$(${readVersion} ${shellQuote(`${mount}/Unvibe.app/Contents/Info.plist`)} 2>/dev/null)" = ${wanted} ] || refuse`,
    `rm -rf ${staged}`,
    `ditto --noacl --noextattr --norsrc ${mounted} ${staged} || refuse`,
    `chmod -R u+rwX,go-w ${staged} || refuse`,
    `codesign --verify --deep --strict -R=${pin} ${staged} >/dev/null 2>&1 || refuse`,
    `[ "$(${readVersion} ${shellQuote(`${target}.new/Contents/Info.plist`)} 2>/dev/null)" = ${wanted} ] || refuse`,
    // A `.old` an earlier update couldn't delete is moved out of the way under a unique name, so
    // the installed app is never moved into it.
    `rm -rf ${old} 2>/dev/null`,
    `if [ -e ${old} ] || [ -L ${old} ]; then mv ${old} ${old}."$$" || refuse; fi`,
    // An app running from elsewhere (e.g. ~/Downloads) updates into a target that doesn't exist yet.
    `if [ -e ${installed} ] || [ -L ${installed} ]; then mv ${installed} ${old} || refuse; fi`,
    `mv ${staged} ${installed} || { if [ -e ${old} ] || [ -L ${old} ]; then mv ${old} ${installed}; fi; refuse; }`,
    `rm -rf ${old} 2>/dev/null`,
    `hdiutil detach ${shellQuote(mount)} -force >/dev/null 2>&1`,
    `open ${installed}`,
    `rm -rf ${shellQuote(dir)}`,
    '',
  ].join('\n');
}

/** Starts a detached process and resolves once Windows has actually created it. */
function launchDetached(command: string, args: string[]): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      child.once('error', (error) => resolve({ ok: false, error: `Could not start the update: ${error.message}` }));
      child.once('spawn', () => {
        child.unref();
        resolve({ ok: true });
      });
    } catch (error) {
      resolve({ ok: false, error: `Could not start the update: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}

/**
 * Downloads the installer for `info`, checks it against the release's published checksum and, on
 * macOS, writes the helper (`update.sh`) that swaps the app after Unvibe quits. The check runs in
 * this process, before any helper exists: a download that fails it (or can't be checked) is
 * deleted, and the installed app is never touched. The portable build has no installer: it
 * downloads beside the running .exe (`portable`), and only that download is ever deleted there.
 */
export async function prepareUpdate(
  info: UpdateInfo,
  opts: { platform: NodeJS.Platform; fetchImpl: Fetch; pid: number; portable?: string; macTarget?: string; workRoot?: string; onProgress?: (pct: number) => void },
): Promise<{ ok: true; file: string; script?: string } | { ok: false; error: string }> {
  const { platform, fetchImpl, pid, portable, macTarget = '/Applications/Unvibe.app', workRoot = tmpdir(), onProgress } = opts;
  if (!info.available || !info.url || !info.latest) return { ok: false, error: 'You already have the newest Unvibe.' };
  // The parsed address (`href`) is what gets fetched, so that is what must match, not the raw string.
  const assetUrl = URL.canParse(info.url) ? new URL(info.url).href : '';
  if (!ASSET_HOST.test(assetUrl)) return { ok: false, error: 'Refusing to download an update from an unexpected address.' };
  // A downloaded app that was opened without being moved runs from a read-only copy (App
  // Translocation), so the helper could never replace it and the update would silently do nothing.
  if (platform === 'darwin' && macTarget.includes('/AppTranslocation/')) return { ok: false, error: 'Move Unvibe to your Applications folder first, then update.' };

  const assetName = path.basename(new URL(assetUrl).pathname);
  const dir = portable ? path.dirname(portable) : await mkdtemp(path.join(workRoot, 'unvibe-update-'));
  const file = portable ? `${portable}.download` : path.join(dir, assetName);
  const discard = () => rm(portable ? file : dir, { recursive: true, force: true }).catch(() => undefined);
  try {
    const res = await fetchImpl(assetUrl, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60_000) });
    if (!res.ok || !res.body) {
      await discard();
      return { ok: false, error: `Download failed (${res.status}).` };
    }
    const total = Number(res.headers.get('content-length') ?? 0);
    let received = 0;
    const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
    body.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (total && onProgress) onProgress(Math.min(99, Math.round((received / total) * 100)));
    });
    await pipeline(body, createWriteStream(file));
  } catch (error) {
    // The portable folder may be read-only (e.g. a protected drive); say so instead of crashing.
    await discard();
    return { ok: false, error: `Download failed: ${error instanceof Error ? error.message : String(error)}` };
  }

  let problem: string | null;
  try {
    problem = await verifyDownload(file, assetUrl, platform, fetchImpl);
  } catch (error) {
    problem = `Could not check the download (${error instanceof Error ? error.message : String(error)}). The update was not installed, and your Unvibe is unchanged.`;
  }
  if (problem) {
    await discard();
    return { ok: false, error: problem };
  }

  if (platform !== 'darwin') return { ok: true, file };
  const script = path.join(dir, 'update.sh');
  await writeFile(script, macUpdateScript({ pid, file, dir, mount: path.join(dir, 'mnt'), target: macTarget, version: info.latest }), { mode: 0o700 });
  return { ok: true, file, script };
}

/** Downloads the installer, then hands off to a detached helper and quits. */
let installing = false;

export async function installUpdate(onProgress?: (pct: number) => void): Promise<{ ok: boolean; error?: string }> {
  // The notification and the Home card can both start an install; only one runs.
  if (installing) return { ok: true };
  installing = true;
  try {
    return await runInstall(onProgress);
  } finally {
    installing = false;
  }
}

async function runInstall(onProgress?: (pct: number) => void): Promise<{ ok: boolean; error?: string }> {
  const info = await checkForUpdate(true);
  // The portable build swaps the downloaded .exe into the same path, so pinned shortcuts and
  // double-clicks start the new version.
  const portable = portableExecutable();
  const bundle = macBundlePath();
  const prepared = await prepareUpdate(info, {
    platform: process.platform,
    fetchImpl: networkFetch,
    pid: process.pid,
    portable,
    macTarget: bundle.endsWith('.app') && !bundle.startsWith('/Volumes/') ? bundle : '/Applications/Unvibe.app',
    onProgress,
  });
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const { file } = prepared;

  if (process.platform === 'darwin' && prepared.script) {
    spawn('/bin/bash', [prepared.script], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'win32') {
    let launched: { ok: boolean; error?: string };
    if (portable) {
      // A partial download never carries the real name, so only a complete .exe is started.
      // Windows lets a running .exe be renamed on the same drive, so move it aside first.
      const old = `${portable}.old`;
      try {
        await rm(old, { force: true });
        await rename(portable, old);
        try {
          await rename(file, portable);
        } catch (error) {
          await rename(old, portable).catch(() => undefined);
          throw error;
        }
      } catch (error) {
        await rm(file, { force: true }).catch(() => undefined);
        return { ok: false, error: `Could not save the update: ${error instanceof Error ? error.message : String(error)}` };
      }
      launched = await launchDetached(portable, []);
    } else {
      // Silent NSIS install into the existing location; --force-run starts Unvibe again after.
      launched = await launchDetached(file, ['/S', '--force-run']);
    }
    if (!launched.ok) return launched;
  } else {
    return { ok: false, error: 'Automatic updates are not available on this system.' };
  }
  onProgress?.(100);
  // Quit normally so sync and windows close cleanly; force it if something holds on.
  setTimeout(() => app.quit(), 300);
  setTimeout(() => app.exit(0), 4000);
  return { ok: true };
}
