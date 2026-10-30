/**
 * The in-app product-market-fit survey (Sean Ellis / Superhuman, ledger 361, backlog FE-09), built to
 * Security's requirements (boss-handoff security/20261030-0728). The desktop app sends only the
 * answers (Q1 enum and 3 texts) and its version, with its random install ID in the trial header,
 * and only when the person presses Send. Each install answers at most once per 90 days, enforced
 * here atomically (`submit_pmf_response`); a repeat is a 409 and the first answer is kept.
 *
 * Rows live in `public.pmf_responses` (migration 20261030120000) for 12 months. The install ID is
 * stored only as an HMAC keyed by a server secret, the same secret and fallback as the try_requests
 * IP hashes (`hashVisitor`), so a leaked table can't be matched to install IDs without the key.
 * Answer text is never logged. Process memory stands in only outside production without Supabase.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { serviceSupabase } from '@/lib/serviceSupabase';
import { hashVisitor, looksSecret } from '@/lib/tryDemo';

export const PMF_CONSENT = 'pmf-v1';
export const PMF_Q1 = ['very', 'somewhat', 'not', 'na'] as const;
export type PmfQ1 = (typeof PMF_Q1)[number];

/** Per text answer, in UTF-16 units like the app's textarea maxLength; the table's check counts code points, which is never more. */
export const PMF_MAX_TEXT_CHARS = 2000;
export const PMF_MAX_BODY_BYTES = 16_384;
/** Like /try: an hourly cap per network (HMAC of the IP, never stored raw) and a daily cap for everyone. */
export const PMF_PER_IP_PER_HOUR = 10;
export const PMF_GLOBAL_PER_DAY = 1000;
const REPEAT_WINDOW_MS = 90 * 86_400_000;
const EXPORT_PAGE = 1000;

const BODY_KEYS: Record<string, true> = { q1: true, q2: true, q3: true, q4: true, appVersion: true, consent: true };
const TEXT_KEYS = ['q2', 'q3', 'q4'] as const;
const APP_VERSION_RE = /^[0-9A-Za-z.+-]{1,40}$/;

export interface PmfAnswer {
  q1: PmfQ1;
  q2: string;
  q3: string;
  q4: string;
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
  app_version: string;
}

interface StoredRow extends Omit<PmfExportRow, 'date'> {
  created_at: string;
}

let localInstallKeySecret: string | undefined;

/**
 * The stored form of an install ID: HMAC-SHA256 under TRY_IP_SALT, else the Supabase service-role
 * key (as `hashVisitor` keys the try_requests IP hashes). Null in production with neither, so the
 * route refuses rather than store a hash anyone could recompute. Outside production a random
 * per-process key stands in. A deletion request with an install ID is found by recomputing this.
 */
export function pmfInstallKey(installId: string): string | null {
  const secret = process.env.TRY_IP_SALT?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret && process.env.NODE_ENV === 'production') return null;
  const key = secret || (localInstallKeySecret ??= randomBytes(32).toString('hex'));
  return createHmac('sha256', key).update(`unvibe-pmf-install:${installId}`).digest('hex');
}

/**
 * Strict validation: a JSON object with only the known keys, `consent: 'pmf-v1'`, q1 from the enum
 * (the same 4 values as the table's check), q2 to q4 strings of at most 2,000 characters after
 * trimming (missing means empty) and a plain app version. A text that looks like a key or password
 * (the shared detector the Try it box uses) is refused. Field names only, never values, come back.
 */
export function parsePmfAnswer(body: unknown): { answer: PmfAnswer } | { invalid: string } | { secret: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { invalid: 'body' };
  const unknownKey = Object.keys(body).find((key) => !Object.hasOwn(BODY_KEYS, key));
  if (unknownKey !== undefined) return { invalid: 'unknown_key' };
  const b = body as Record<string, unknown>;
  if (b.consent !== PMF_CONSENT) return { invalid: 'consent' };
  if (typeof b.q1 !== 'string' || !(PMF_Q1 as readonly string[]).includes(b.q1)) return { invalid: 'q1' };
  const texts: Record<(typeof TEXT_KEYS)[number], string> = { q2: '', q3: '', q4: '' };
  for (const key of TEXT_KEYS) {
    const value = b[key] ?? '';
    if (typeof value !== 'string') return { invalid: key };
    const trimmed = value.trim();
    if (trimmed.length > PMF_MAX_TEXT_CHARS) return { invalid: key };
    if (looksSecret(trimmed)) return { secret: key };
    texts[key] = trimmed;
  }
  const appVersion = typeof b.appVersion === 'string' ? b.appVersion.trim() : '';
  if (!APP_VERSION_RE.test(appVersion)) return { invalid: 'appVersion' };
  return { answer: { q1: b.q1 as PmfQ1, ...texts, appVersion } };
}

function memory(): { rows: StoredRow[]; hits: Map<string, number[]> } {
  const g = globalThis as unknown as { __unvibePmf?: { rows: StoredRow[]; hits: Map<string, number[]> } };
  g.__unvibePmf ??= { rows: [], hits: new Map() };
  return g.__unvibePmf;
}

/**
 * Counts this request against the caller's network (hourly) and everyone (daily), through the
 * shared `consume_rate_limit` counter. 'unavailable' when the store fails or production has no
 * secret for the IP HMAC: a broken limiter never means no limit.
 */
export async function reservePmfRequest(ip: string, now = new Date()): Promise<'ok' | 'limited' | 'unavailable'> {
  const visitor = hashVisitor(ip);
  if (!visitor) return 'unavailable';
  const rules = [
    { bucket: `pmf-ip:${visitor}`, windowSeconds: 3600, max: PMF_PER_IP_PER_HOUR },
    { bucket: 'pmf-all', windowSeconds: 86_400, max: PMF_GLOBAL_PER_DAY },
  ];
  const db = serviceSupabase();
  if (!db) {
    if (process.env.NODE_ENV === 'production') return 'unavailable';
    const { hits } = memory();
    for (const rule of rules) {
      const recent = (hits.get(rule.bucket) ?? []).filter((t) => now.getTime() - t < rule.windowSeconds * 1000);
      recent.push(now.getTime());
      hits.set(rule.bucket, recent);
      if (recent.length > rule.max) return 'limited';
    }
    return 'ok';
  }
  for (const rule of rules) {
    const { data, error } = await db.rpc('consume_rate_limit', { p_bucket: rule.bucket, p_window_seconds: rule.windowSeconds, p_max: rule.max });
    if (error || typeof data !== 'boolean') {
      console.error('pmf rate limit failed', error?.code ?? 'unexpected response');
      return 'unavailable';
    }
    if (!data) return 'limited';
  }
  return 'ok';
}

/**
 * Store one answer unless this install answered in the last 90 days ('duplicate'; the first answer
 * is untouched). In Supabase this is one call to `submit_pmf_response`, which checks and inserts
 * under a per-install advisory lock and deletes answers older than 12 months. 'unavailable' is a
 * storage failure, logged by error code only: a check-constraint message would hold answer text.
 */
export async function recordPmfAnswer(installKey: string, answer: PmfAnswer, now = new Date()): Promise<'stored' | 'duplicate' | 'unavailable'> {
  const db = serviceSupabase();
  if (!db) {
    if (process.env.NODE_ENV === 'production') return 'unavailable';
    const { rows } = memory();
    const since = new Date(now.getTime() - REPEAT_WINDOW_MS).toISOString();
    if (rows.some((r) => r.install_key === installKey && r.created_at >= since)) return 'duplicate';
    rows.push({ install_key: installKey, created_at: now.toISOString(), q1: answer.q1, q2: answer.q2, q3: answer.q3, q4: answer.q4, app_version: answer.appVersion });
    return 'stored';
  }
  const { data, error } = await db.rpc('submit_pmf_response', {
    p_install_key: installKey,
    p_q1: answer.q1,
    p_q2: answer.q2,
    p_q3: answer.q3,
    p_q4: answer.q4,
    p_app_version: answer.appVersion,
  });
  if (error) {
    console.error('pmf answer store failed', error.code);
    return 'unavailable';
  }
  if (data === 'duplicate') return 'duplicate';
  return data === 'ok' ? 'stored' : 'unavailable';
}

function exportRow(row: StoredRow): PmfExportRow {
  return {
    install_key: row.install_key,
    date: new Date(row.created_at).toISOString().slice(0, 10),
    q1: row.q1,
    q2: row.q2,
    q3: row.q3,
    q4: row.q4,
    app_version: row.app_version,
  };
}

/** Answers from the last 12 months (the retention period), oldest first. Null when storage is unavailable. */
export async function pmfExportRows(now = new Date()): Promise<PmfExportRow[] | null> {
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - 12);
  const db = serviceSupabase();
  if (!db) {
    if (process.env.NODE_ENV === 'production') return null;
    return memory().rows
      .filter((r) => r.created_at >= since.toISOString())
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(exportRow);
  }
  const rows: PmfExportRow[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    const { data, error } = await db
      .from('pmf_responses')
      .select('install_key, created_at, q1, q2, q3, q4, app_version')
      .gte('created_at', since.toISOString())
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
