import { app } from 'electron';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
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
    const name = pickAsset(release.assets.map((a) => a.name), process.platform, process.arch);
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

/** Downloads the installer, then hands off to a detached helper and quits. */
export async function installUpdate(onProgress?: (pct: number) => void): Promise<{ ok: boolean; error?: string }> {
  const info = await checkForUpdate(true);
  if (!info.available || !info.url) return { ok: false, error: 'You already have the newest Unvibe.' };
  if (!ASSET_HOST.test(info.url)) return { ok: false, error: 'Refusing to download an update from an unexpected address.' };

  const dir = await mkdtemp(path.join(tmpdir(), 'unvibe-update-'));
  const file = path.join(dir, path.basename(new URL(info.url).pathname));
  const res = await networkFetch(info.url, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok || !res.body) return { ok: false, error: `Download failed (${res.status}).` };
  const total = Number(res.headers.get('content-length') ?? 0);
  let received = 0;
  const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  body.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (total && onProgress) onProgress(Math.min(99, Math.round((received / total) * 100)));
  });
  await pipeline(body, createWriteStream(file));

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
    // The NSIS installer replaces the installed app and starts it again when it finishes.
    spawn(file, [], { detached: true, stdio: 'ignore' }).unref();
  } else {
    return { ok: false, error: 'Automatic updates are not available on this system.' };
  }
  onProgress?.(100);
  // Quit normally so sync and windows close cleanly; force it if something holds on.
  setTimeout(() => app.quit(), 300);
  setTimeout(() => app.exit(0), 4000);
  return { ok: true };
}
