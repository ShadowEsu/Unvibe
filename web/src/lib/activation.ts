/**
 * Write-once funnel markers for the founder dashboard (instrumentation spec 2026-10-22 sections 4-7,
 * first-run spec section 4). The desktop app sends no analytics SDK events; see unvibe.site/privacy.
 *
 * For each anonymous trial install key, at most one row per kind, `(install_key, kind, at)`:
 * - `sample`: the first explanation of the built-in first-run sample (onboarding step 2);
 * - `code`:   the first explanation of any other code (the user's own selection);
 * - `return`: written here on the server: an explanation on a later 24 h block of the install's
 *   first week than its first explanation (`recordActivation`);
 * - progress kinds the server cannot see, reported by the app through POST /api/v1/trial/progress
 *   (`recordProgress`): setup finished, Accessibility asked and granted, signed in (UTC day only),
 *   level question answered, launch-at-login question shown and accepted.
 * Each row stores only a timestamp. No code, prompt, file name, email or IP is stored.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
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

const DAY_MS = 86_400_000;
const RETURN_WINDOW_DAYS = 7;

/** Kinds the app reports itself (A-spec 6.2 plus the first-run spec section 4). */
export const PROGRESS_KINDS = [
  'onboarded',
  'accessibility',
  'signed_in',
  'accessibility_asked',
  'level_answered',
  'login_prompt_shown',
  'login_prompt_accepted',
] as const;
export type ProgressKind = (typeof PROGRESS_KINDS)[number];

export function isProgressKind(value: unknown): value is ProgressKind {
  return typeof value === 'string' && (PROGRESS_KINDS as readonly string[]).includes(value);
}

type MarkerKind = ActivationKind | ProgressKind | 'return';

/** One write-once row. True when it is stored (now or before). */
async function writeMarker(db: SupabaseClient, installKey: string, kind: MarkerKind, at: Date): Promise<boolean> {
  const { error } = await db
    .from('trial_activation')
    .upsert({ install_key: installKey, kind, at: at.toISOString() }, { onConflict: 'install_key,kind', ignoreDuplicates: true });
  if (error) {
    console.error(`${kind} marker write failed`, error.message);
    return false;
  }
  return true;
}

/**
 * Which 24 h block of the install's life `at` falls in (0 = the first 24 h after first launch).
 * A-spec 6.3: `return` needs the first explanation and this one in different blocks.
 */
export function returnBlock(startedAt: number, at: number): number {
  return Math.floor((at - startedAt) / DAY_MS);
}

/**
 * `return` (A7): this explanation is in [started_at + 24 h, started_at + 7 d) and the install's first
 * `sample`/`code` marker is in an earlier 24 h block. Write-once, like every marker.
 */
async function recordReturn(db: SupabaseClient, installKey: string, startedAt: string, now: Date): Promise<void> {
  const marker = `return:${installKey}`;
  const start = Date.parse(startedAt);
  if (written.has(marker) || Number.isNaN(start)) return;
  const block = returnBlock(start, now.getTime());
  if (block < 1 || block >= RETURN_WINDOW_DAYS) return;
  const { data, error } = await db
    .from('trial_activation')
    .select('at')
    .eq('install_key', installKey)
    .in('kind', ['sample', 'code'])
    .order('at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('return marker read failed', error.message);
    return;
  }
  const first = typeof data?.at === 'string' ? Date.parse(data.at) : Number.NaN;
  if (Number.isNaN(first) || returnBlock(start, first) >= block) return;
  if (await writeMarker(db, installKey, 'return', now)) written.add(marker);
}

/**
 * Write-once (trial_activation), best effort: activation never blocks or fails an explanation.
 * `startedAt` is the install's first online launch (from `reserveTrialAction`), for `return`.
 */
export async function recordActivation(
  installKey: string,
  code: string | undefined,
  { now = new Date(), startedAt }: { now?: Date; startedAt?: string } = {},
): Promise<void> {
  const db = serviceSupabase();
  if (!db) return;
  const kind = activationKind(code);
  const marker = `${kind}:${installKey}`;
  if (!written.has(marker) && await writeMarker(db, installKey, kind, now)) written.add(marker);
  if (startedAt) await recordReturn(db, installKey, startedAt, now);
}

/**
 * Store one app-reported progress marker. Only for an install that already has its trial_installs
 * row: a ping never creates an install or starts a trial clock, and random install IDs (the trial
 * token ships in the app) cannot leave orphan rows. `signed_in` keeps only the UTC day.
 * Returns 'no_install' when the row is missing (the app retries on its next launch), else 'done'
 * (written, already there, or a logged storage error). Never throws.
 */
export async function recordProgress(installKey: string, kind: ProgressKind, now = new Date()): Promise<'done' | 'no_install'> {
  const db = serviceSupabase();
  const marker = `${kind}:${installKey}`;
  if (!db || written.has(marker)) return 'done';
  const { data, error } = await db.from('trial_installs').select('install_key').eq('install_key', installKey).maybeSingle();
  if (error) {
    console.error('progress install read failed', error.message);
    return 'done';
  }
  if (!data) return 'no_install';
  const at = new Date(now);
  if (kind === 'signed_in') at.setUTCHours(0, 0, 0, 0);
  if (await writeMarker(db, installKey, kind, at)) written.add(marker);
  return 'done';
}
