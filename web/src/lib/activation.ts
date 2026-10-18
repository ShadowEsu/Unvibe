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
import { serviceSupabase } from '@/lib/serviceSupabase';

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

const normalize = (code: string) => code.replace(/\r\n/g, '\n').trim();
const SAMPLE_HASH = createHash('sha256').update(normalize(FIRST_RUN_SAMPLE)).digest('hex');

/** Which marker an explanation of this code counts toward. */
export function activationKind(code: string | undefined): ActivationKind {
  if (!code) return 'code';
  return createHash('sha256').update(normalize(code)).digest('hex') === SAMPLE_HASH ? 'sample' : 'code';
}

/** Markers this instance already wrote, so repeat explanations skip the round trip. */
const written = new Set<string>();

/** Write-once (trial_activation), best effort: activation never blocks or fails an explanation. */
export async function recordActivation(installKey: string, code: string | undefined, now = new Date()): Promise<void> {
  const db = serviceSupabase();
  const kind = activationKind(code);
  const marker = `${kind}:${installKey}`;
  if (!db || written.has(marker)) return;
  const { error } = await db
    .from('trial_activation')
    .upsert({ install_key: installKey, kind, at: now.toISOString() }, { onConflict: 'install_key,kind', ignoreDuplicates: true });
  if (error) {
    console.error('activation marker write failed', error.message);
    return;
  }
  written.add(marker);
}
