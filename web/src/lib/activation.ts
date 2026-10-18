/**
 * Activation markers for the founder dashboard, recorded on the server from requests the app
 * already makes (the desktop app sends no analytics; see unvibe.site/privacy).
 *
 * For each anonymous trial install key, at most two write-once markers:
 * - `sample`: the first explanation of the built-in first-run sample (onboarding step 2);
 * - `code`:   the first explanation of any other code (the user's own selection).
 * Each marker stores only a timestamp. No code, prompt, email or IP is stored.
 */
import { createHash } from 'node:crypto';
import { put } from '@vercel/blob';

/** Must match FIRST_RUN_SAMPLE in app/src/main/main.ts. */
export const FIRST_RUN_SAMPLE = [
  'function debounce(fn, wait) {',
  '  let timer;',
  '  return (...args) => {',
  '    clearTimeout(timer);',
  '    timer = setTimeout(() => fn(...args), wait);',
  '  };',
  '}',
].join('\n');

export type ActivationKind = 'sample' | 'code';
export const ACTIVATION_PREFIX = 'trial-usage/v2/activation/';

const normalize = (code: string) => code.replace(/\r\n/g, '\n').trim();
const SAMPLE_HASH = createHash('sha256').update(normalize(FIRST_RUN_SAMPLE)).digest('hex');

/** Which marker an explanation of this code counts toward. */
export function activationKind(code: string | undefined): ActivationKind {
  if (!code) return 'code';
  return createHash('sha256').update(normalize(code)).digest('hex') === SAMPLE_HASH ? 'sample' : 'code';
}

const written = new Set<string>();

/** Write-once, best effort: activation never blocks or fails an explanation. */
export async function recordActivation(installKey: string, code: string | undefined, now = new Date()): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const path = `${ACTIVATION_PREFIX}${activationKind(code)}/${installKey}.json`;
  if (!token || written.has(path)) return;
  written.add(path);
  try {
    await put(path, JSON.stringify({ at: now.toISOString() }), {
      access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json', token,
    });
  } catch {
    // Already recorded (allowOverwrite: false) or storage unavailable.
  }
}
