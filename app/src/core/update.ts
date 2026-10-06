/** Pure helpers for the self-updater (kept free of Electron so they are unit tested). */

/** True when version a is newer than b (plain x.y.z). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** The installer this machine needs from a release's asset names. */
export function pickAsset(names: string[], platform: NodeJS.Platform, arch: string): string | undefined {
  if (platform === 'darwin') {
    const want = arch === 'arm64' ? 'mac-arm64.dmg' : 'mac-x64.dmg';
    return names.find((n) => n.endsWith(want));
  }
  if (platform === 'win32') return names.find((n) => n.endsWith('win-x64-setup.exe'));
  return undefined;
}
