/**
 * Aggregate desktop install counts for the founder dashboard, from the Supabase trial tables.
 * Counts only. It never returns install keys, emails, code, or prompts.
 */
import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivationKind } from '@/lib/activation';
import { serviceSupabase } from '@/lib/serviceSupabase';
import { isInstallCounterKey } from '@/lib/trialAccess';

export interface InstallStats {
  /** Installs that have made at least one trial AI request, all time. */
  installs: number;
  newToday: number;
  new7d: number;
  new30d: number;
  /** Installs whose explanation counter changed in the window (a proxy for active users). */
  active7d: number;
  active30d: number;
  /**
   * Last 14 UTC days, oldest first. `installs`: first trial AI request; `sample`: first-run sample
   * explained; `code`: first explanation of the user's own code (the activation number).
   */
  daily: DailyActivation[];
  /** CI/QA installs left out of every number above (flagged by the real-device test). */
  qaExcluded: number;
  source: 'supabase' | 'unavailable';
  generatedAt: string;
}

export interface DailyActivation {
  day: string;
  installs: number;
  sample: number;
  code: number;
}

export interface ActivationMarker {
  kind: ActivationKind;
  at: Date;
}

const GLOBAL_INSTALL_KEY = '__global__';
const DAY_MS = 86_400_000;
const DAILY_DAYS = 14;
/** PostgREST caps responses (1000 rows by default), so row fetches are paged. */
const PAGE_SIZE = 1000;

/** True when the bearer token matches UNVIBE_ADMIN_STATS_TOKEN. Fails closed when unset. */
export function isAdminStatsRequest(req: Request, secret = process.env.UNVIBE_ADMIN_STATS_TOKEN?.trim()): boolean {
  if (!secret || secret.length < 24) return false;
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  const token = match?.[1]?.trim() ?? '';
  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Pure window counting so it can be unit tested without storage. `installStarts` and
 * `explanationUpdates` need only cover the last 30 days; `total` is the all-time install count.
 */
export function summarizeInstalls(
  total: number,
  installStarts: Date[],
  explanationUpdates: Date[],
  now = new Date(),
): Omit<InstallStats, 'source' | 'generatedAt' | 'daily' | 'qaExcluded'> {
  const since = (days: number) => now.getTime() - days * DAY_MS;
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const after = (items: Date[], ms: number) => items.filter((at) => at.getTime() >= ms).length;
  return {
    installs: total,
    newToday: after(installStarts, startOfDay.getTime()),
    new7d: after(installStarts, since(7)),
    new30d: after(installStarts, since(30)),
    active7d: after(explanationUpdates, since(7)),
    active30d: after(explanationUpdates, since(30)),
  };
}

/** Per-UTC-day counts. Install records and activation markers are write-once, so each time is the first. */
export function dailyActivation(installStarts: Date[], activation: ActivationMarker[], now = new Date(), days = DAILY_DAYS): DailyActivation[] {
  const rows: DailyActivation[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    rows.push({ day: new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10), installs: 0, sample: 0, code: 0 });
  }
  const byDay = new Map(rows.map((row) => [row.day, row]));
  for (const at of installStarts) {
    const row = byDay.get(at.toISOString().slice(0, 10));
    if (row) row.installs += 1;
  }
  for (const marker of activation) {
    const row = byDay.get(marker.at.toISOString().slice(0, 10));
    if (row) row[marker.kind] += 1;
  }
  return rows;
}

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** Fetch every row of a query ordered by a stable key, one page at a time. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${what} query failed: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

async function countInstalls(db: SupabaseClient, qa: boolean): Promise<number> {
  const { count, error } = await db
    .from('trial_installs')
    .select('install_key', { count: 'exact', head: true })
    .neq('install_key', GLOBAL_INSTALL_KEY)
    .eq('qa', qa);
  if (error) throw new Error(`trial_installs count failed: ${error.message}`);
  return count ?? 0;
}

export async function installStats(now = new Date()): Promise<InstallStats> {
  const generatedAt = now.toISOString();
  const db = serviceSupabase();
  if (!db) {
    return { installs: 0, newToday: 0, new7d: 0, new30d: 0, active7d: 0, active30d: 0, daily: [], qaExcluded: 0, source: 'unavailable', generatedAt };
  }
  const since30d = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const firstDay = new Date(now.getTime() - (DAILY_DAYS - 1) * DAY_MS);
  firstDay.setUTCHours(0, 0, 0, 0);
  const [total, qaExcluded, qaKeys, installs, explanations, activation] = await Promise.all([
    countInstalls(db, false),
    countInstalls(db, true),
    fetchAll<{ install_key: string }>((from, to) => db
      .from('trial_installs')
      .select('install_key')
      .eq('qa', true)
      .order('install_key')
      .range(from, to), 'trial_installs qa'),
    fetchAll<{ install_key: string; started_at: string }>((from, to) => db
      .from('trial_installs')
      .select('install_key, started_at')
      .neq('install_key', GLOBAL_INSTALL_KEY)
      .eq('qa', false)
      .gte('started_at', since30d)
      .order('install_key')
      .range(from, to), 'trial_installs'),
    fetchAll<{ install_key: string; updated_at: string }>((from, to) => db
      .from('trial_counters')
      .select('install_key, updated_at')
      .eq('kind', 'ai_explanation')
      .not('install_key', 'like', '\\_\\_%')
      .gte('updated_at', since30d)
      .order('install_key')
      .range(from, to), 'trial_counters'),
    fetchAll<{ install_key: string; kind: ActivationKind; at: string }>((from, to) => db
      .from('trial_activation')
      .select('install_key, kind, at')
      .gte('at', firstDay.toISOString())
      .order('install_key')
      .order('kind')
      .range(from, to), 'trial_activation'),
  ]);
  const qa = new Set(qaKeys.map((row) => row.install_key));
  const installStarts = installs.map((row) => new Date(row.started_at));
  // Per-IP and global rows (`__…`) are not installs; the query skips them and this keeps it exact.
  const realExplanations = explanations.filter((row) => isInstallCounterKey(row.install_key) && !qa.has(row.install_key));
  const realActivation = activation.filter((row) => !qa.has(row.install_key));
  return {
    ...summarizeInstalls(total, installStarts, realExplanations.map((row) => new Date(row.updated_at)), now),
    daily: dailyActivation(installStarts, realActivation.map((row) => ({ kind: row.kind, at: new Date(row.at) })), now),
    qaExcluded,
    source: 'supabase',
    generatedAt,
  };
}
