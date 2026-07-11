/**
 * Default path exclusions. Milestone 1 uses these to avoid *offering* review of files that
 * would never be sent to a model anyway (secrets, dependencies, build output, binaries).
 *
 * The authoritative secret *scanning* and payload filtering lands in Milestone 2 alongside
 * the AI layer (see docs/privacy.md). This module is intentionally conservative and local.
 */

/** Glob-ish suffixes / names that should never be surfaced for review. */
export const EXCLUDED_BASENAMES = new Set<string>([
  '.env',
  'credentials',
  'id_rsa',
  'id_dsa',
  '.DS_Store',
]);

export const EXCLUDED_EXTENSIONS = new Set<string>([
  '.pem', '.key', '.p12', '.keystore', '.secret',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf',
  '.zip', '.tar', '.gz', '.mp4', '.mov', '.mp3', '.woff', '.woff2', '.ttf',
  '.lock',
]);

export const EXCLUDED_DIR_SEGMENTS = [
  'node_modules', 'dist', 'build', 'out', '.next', 'target',
  'vendor', '.venv', '__pycache__', '.git',
];

/** Returns true if the given absolute path should be excluded from review offers. */
export function isExcludedPath(fsPath: string): boolean {
  const normalized = fsPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const base = segments[segments.length - 1] ?? '';

  if (EXCLUDED_BASENAMES.has(base)) {
    return true;
  }
  if (base.startsWith('.env')) {
    return true;
  }
  for (const ext of EXCLUDED_EXTENSIONS) {
    if (base.endsWith(ext)) {
      return true;
    }
  }
  for (const dir of EXCLUDED_DIR_SEGMENTS) {
    if (segments.includes(dir)) {
      return true;
    }
  }
  return false;
}
