import { app } from 'electron';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { networkFetch } from './backend';
import { isNewer, pickAsset } from '../core/update';

export { isNewer, pickAsset };

/**
 * Self-update without code signing. Checks the public GitHub releases, and on request
 * downloads the right installer, quits, swaps the app in place and reopens it. Only release
 * assets from this repository are ever downloaded.
 */

const REPO = 'ShadowEsu/Unvibe';
const ASSET_HOST = /^https:\/\/github\.com\/ShadowEsu\/Unvibe\/releases\/download\//;

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
  if (!info.available || !info.url) return { ok: false, error: 'You already have the newest Unvibe.' };
  if (!ASSET_HOST.test(info.url)) return { ok: false, error: 'Refusing to download an update from an unexpected address.' };

  const portable = portableExecutable();
  const assetName = path.basename(new URL(info.url).pathname);
  // The portable build has no installer: the new .exe goes next to the one the user runs.
  const dir = portable ? path.dirname(portable) : await mkdtemp(path.join(tmpdir(), 'unvibe-update-'));
  const target = path.join(dir, assetName);
  const file = portable ? `${target}.download` : target;
  const res = await networkFetch(info.url, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok || !res.body) return { ok: false, error: `Download failed (${res.status}).` };
  const total = Number(res.headers.get('content-length') ?? 0);
  let received = 0;
  const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  body.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (total && onProgress) onProgress(Math.min(99, Math.round((received / total) * 100)));
  });
  try {
    await pipeline(body, createWriteStream(file));
  } catch (error) {
    if (!portable) throw error;
    // The portable folder may be read-only (e.g. a protected drive); say so instead of crashing.
    await rm(file, { force: true }).catch(() => undefined);
    return { ok: false, error: `Download failed: ${error instanceof Error ? error.message : String(error)}` };
  }

  if (process.platform === 'darwin') {
    const bundle = macBundlePath();
    const target = bundle.endsWith('.app') && !bundle.startsWith('/Volumes/') ? bundle : '/Applications/Unvibe.app';
    const mount = path.join(dir, 'mnt');
    const script = path.join(dir, 'update.sh');
    await writeFile(script, [
      '#!/bin/bash',
      `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done`,
      `mkdir -p ${shellQuote(mount)}`,
      `hdiutil attach -nobrowse -readonly -mountpoint ${shellQuote(mount)} ${shellQuote(file)} >/dev/null || { open ${shellQuote(target)}; exit 1; }`,
      `if [ -d ${shellQuote(`${mount}/Unvibe.app`)} ]; then`,
      `  rm -rf ${shellQuote(target)}`,
      `  ditto ${shellQuote(`${mount}/Unvibe.app`)} ${shellQuote(target)}`,
      `  xattr -cr ${shellQuote(target)} 2>/dev/null`,
      `  codesign --verify --deep --strict ${shellQuote(target)} >/dev/null 2>&1 || codesign --force --deep --sign - ${shellQuote(target)} >/dev/null 2>&1`,
      'fi',
      `hdiutil detach ${shellQuote(mount)} -force >/dev/null 2>&1`,
      `open ${shellQuote(target)}`,
      `rm -rf ${shellQuote(dir)}`,
      '',
    ].join('\n'), { mode: 0o700 });
    spawn('/bin/bash', [script], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'win32') {
    let launched: { ok: boolean; error?: string };
    if (portable) {
      // A partial download never carries the real name, so only a complete .exe is started.
      try {
        await rename(file, target);
      } catch (error) {
        return { ok: false, error: `Could not save the update: ${error instanceof Error ? error.message : String(error)}` };
      }
      launched = await launchDetached(target, []);
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
