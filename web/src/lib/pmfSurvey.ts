/**
 * The in-app product-market-fit survey (Sean Ellis / Superhuman, ledger 361, backlog FE-09).
 * The desktop app sends the 4 answers, its explanation count and days since install only when the
 * user presses Send. Each install answers at most once per 90 days; a repeat keeps the first answer.
 *
 * Rows live in `public.pmf_responses` (migration 20261030120000) under a pseudonymous key: sha256 of
 * a PMF-only prefix plus the install id, so the raw id is never stored and the key can't be joined
 * to the trial tables. Answer text is never logged. Process memory is used only outside production
 * when Supabase is not configured (dev/tests).
 */
import { createHash } from 'node:crypto';
import { serviceSupabase } from '@/lib/serviceSupabase';

export const PMF_CONSENT = 'pmf-v1';
export const PMF_Q1 = ['very', 'somewhat', 'not', 'na'] as const;
export type PmfQ1 = (typeof PMF_Q1)[number];

const MAX_TEXT_CHARS = 1000;
const MAX_EXPLANATIONS = 100_000;
const MAX_DAYS = 3650;
const APP_VERSION_RE = /^[0-9A-Za-z.+-]{1,40}$/;
const REPEAT_WINDOW_MS = 90 * 86_400_000;
const EXPORT_PAGE = 1000;

export interface PmfAnswer {
  q1: PmfQ1;
  q2: string;
  q3: string;
  q4: string;
  explanations: number;
  daysSinceInstall: number;
  appVersion: string;
}

/** One export row for the Feedback lane's scorer. `date` is the UTC day the answer arrived. */
export interface PmfExportRow {
  install_key: string;
  date: string;
  q1: PmfQ1;
  q2: string;
  q3: string;
  q4: string;
  explanations: number;
  days_since_install: number;
}

interface StoredRow extends Omit<PmfExportRow, 'date'> {
  created_at: string;
  app_version: string;
}

/** The stored key: never the raw install id, and a different hash from `trialInstallKey`. */
export function pmfInstallKey(installId: string): string {
  return createHash('sha256').update(`unvibe-pmf-install:${installId}`).digest('hex');
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // Code points, like Postgres char_length in the table's check.
  return Array.from(trimmed).length <= MAX_TEXT_CHARS ? trimmed : null;
}

function count(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}

/**
 * Validate a request body. Returns the cleaned answer, or the name of the first bad field (consent
 * included). Field names only, never values, so a 400 can't echo answer text.
 */
export function parsePmfAnswer(body: unknown): { answer: PmfAnswer } | { invalid: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { invalid: 'body' };
  const b = body as Record<string, unknown>;
  if (b.consent !== PMF_CONSENT) return { invalid: 'consent' };
  if (typeof b.q1 !== 'string' || !(PMF_Q1 as readonly string[]).includes(b.q1)) return { invalid: 'q1' };
  const q2 = text(b.q2);
  if (q2 === null) return { invalid: 'q2' };
  const q3 = text(b.q3);
  if (q3 === null) return { invalid: 'q3' };
  const q4 = text(b.q4);
  if (q4 === null) return { invalid: 'q4' };
  const explanations = count(b.explanations, MAX_EXPLANATIONS);
  if (explanations === null) return { invalid: 'explanations' };
  const daysSinceInstall = count(b.daysSinceInstall, MAX_DAYS);
  if (daysSinceInstall === null) return { invalid: 'daysSinceInstall' };
  const appVersion = typeof b.appVersion === 'string' ? b.appVersion.trim() : '';
  if (!APP_VERSION_RE.test(appVersion)) return { invalid: 'appVersion' };
  return { answer: { q1: b.q1 as PmfQ1, q2, q3, q4, explanations, daysSinceInstall, appVersion } };
}

function memoryRows(): StoredRow[] {
  const g = globalThis as unknown as { __unvibePmfRows?: StoredRow[] };
  g.__unvibePmfRows ??= [];
  return g.__unvibePmfRows;
}

/**
 * Store one answer unless this install already answered in the last 90 days. 'duplicate' keeps the
 * first answer untouched; 'unavailable' is a storage failure (logged by error code only).
 */
export async function recordPmfAnswer(installKey: string, answer: PmfAnswer, now = new Date()): Promise<'stored' | 'duplicate' | 'unavailable'> {
  const row: StoredRow = {
    install_key: installKey,
    created_at: now.toISOString(),
    q1: answer.q1,
    q2: answer.q2,
    q3: answer.q3,
    q4: answer.q4,
    explanations: answer.explanations,
    days_since_install: answer.daysSinceInstall,
    app_version: answer.appVersion,
  };
  const since = new Date(now.getTime() - REPEAT_WINDOW_MS).toISOString();
  const db = serviceSupabase();
  if (!db) {
    if (process.env.NODE_ENV === 'production') return 'unavailable';
    const rows = memoryRows();
    if (rows.some((r) => r.install_key === installKey && r.created_at >= since)) return 'duplicate';
    rows.push(row);
    return 'stored';
  }
  const { data, error } = await db
    .from('pmf_responses')
    .select('id')
    .eq('install_key', installKey)
    .gte('created_at', since)
    .limit(1);
  if (error) {
    console.error('pmf repeat check failed', error.code);
    return 'unavailable';
  }
  if (Array.isArray(data) && data.length > 0) return 'duplicate';
  const { error: insertError } = await db.from('pmf_responses').insert(row);
  if (insertError) {
    // The code only: a check-constraint error's details would contain the answer text.
    console.error('pmf answer insert failed', insertError.code);
    return 'unavailable';
  }
  return 'stored';
}

function exportRow(row: StoredRow): PmfExportRow {
  return {
    install_key: row.install_key,
    date: new Date(row.created_at).toISOString().slice(0, 10),
    q1: row.q1,
    q2: row.q2,
    q3: row.q3,
    q4: row.q4,
    explanations: row.explanations,
    days_since_install: row.days_since_install,
  };
}

/** Every answer, oldest first, for the admin export. Null when storage is unavailable. */
export async function pmfExportRows(): Promise<PmfExportRow[] | null> {
  const db = serviceSupabase();
  if (!db) return process.env.NODE_ENV === 'production' ? null : [...memoryRows()].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(exportRow);
  const rows: PmfExportRow[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    const { data, error } = await db
      .from('pmf_responses')
      .select('install_key, created_at, q1, q2, q3, q4, explanations, days_since_install')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + EXPORT_PAGE - 1);
    if (error) {
      console.error('pmf export read failed', error.code);
      return null;
    }
    const page = (data ?? []) as StoredRow[];
    rows.push(...page.map(exportRow));
    if (page.length < EXPORT_PAGE) return rows;
  }
}
