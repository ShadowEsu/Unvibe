/**
 * Sealed desktop trial access. The shared trial token is NOT a provider API key —
 * Gemini/Anthropic keys stay server-side. Each install receives a hard 30-day AI and follow-up budget.
 *
 * The token ships in the app and install ids are chosen by the client, so per-install counters alone
 * do not bound spend. Every trial AI request also counts against:
 * - its network: `__ip__:YYYY-MM-DD:<hmac of the IP>`, UNVIBE_TRIAL_IP_DAILY_LIMIT (default 150, a classroom NAT);
 * - everyone this month: `__global__:YYYY-MM`, UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT (default 50,000);
 * - everyone today: `__global_day__:YYYY-MM-DD`, UNVIBE_TRIAL_GLOBAL_DAILY_LIMIT (default 2,000).
 * Periods are UTC. If any counter cannot be reserved the request is refused (503), never allowed.
 *
 * Durable counters live in Supabase (trial_installs / trial_counters, atomic trial_reserve RPC).
 * Process memory is used only when Supabase is not configured (dev/tests).
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isIPv6 } from 'node:net';
import { serviceSupabase } from '@/lib/serviceSupabase';
import type { UsageKind } from '@/billing/types';

export type TrialKind = Extract<UsageKind, 'ai_explanation' | 'project_question'>;

export interface TrialUsageLine {
  kind: TrialKind;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

interface TrialInstallRecord {
  startedAt: string;
}

interface TrialCounter {
  used: number;
}

const INSTALL_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;
/**
 * trial_counters.kind only allows the two trial kinds, so the shared per-IP and global rows,
 * which count every trial AI request whatever its kind, are stored under this one.
 */
const SHARED_COUNTER_KIND: TrialKind = 'ai_explanation';

const TRIAL_DURATION_DAYS = 30;

function trialWindow(startedAt: string, now = new Date()): { expiresAt: string; expired: boolean } {
  const start = new Date(startedAt);
  const validStart = Number.isNaN(start.getTime()) ? now : start;
  const expires = new Date(validStart.getTime() + TRIAL_DURATION_DAYS * 86_400_000);
  return { expiresAt: expires.toISOString(), expired: now >= expires };
}

function trialSecret(): string | null {
  const value = process.env.UNVIBE_TRIAL_TOKEN?.trim();
  return value || null;
}

function limitFromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function limitFor(kind: TrialKind): number {
  return kind === 'ai_explanation'
    ? limitFromEnv('UNVIBE_TRIAL_EXPLANATION_LIMIT', 50)
    : limitFromEnv('UNVIBE_TRIAL_FOLLOW_UP_LIMIT', 50);
}

/** Shared counter for all trial AI requests this UTC month. */
export function trialGlobalMonthKey(now = new Date()): string {
  return `__global__:${now.toISOString().slice(0, 7)}`;
}

/** Shared counter for all trial AI requests this UTC day. */
export function trialGlobalDayKey(now = new Date()): string {
  return `__global_day__:${now.toISOString().slice(0, 10)}`;
}

/**
 * The unit the per-IP cap counts. IPv4 is used as is. IPv6 is grouped by its /64, because one host
 * usually holds a whole /64 and could otherwise rotate addresses past the cap. IPv4-mapped IPv6
 * (`::ffff:a.b.c.d`) counts as the IPv4. Anything unparseable (e.g. `local`) is used as is.
 */
function ipNetwork(raw: string): string {
  const ip = raw.trim().replace(/^\[(.*)\]$/, '$1').replace(/%.*$/, '').toLowerCase();
  if (!isIPv6(ip)) return ip;
  // Hextets of one side of `::`; a trailing dotted quad is the last two hextets.
  const hextets = (part: string): number[] => (part ? part.split(':') : []).flatMap((group) => {
    if (!group.includes('.')) return [parseInt(group, 16)];
    const [a = 0, b = 0, c = 0, d = 0] = group.split('.').map(Number);
    return [(a << 8) | b, (c << 8) | d];
  });
  const gap = ip.indexOf('::');
  const left = hextets(gap === -1 ? ip : ip.slice(0, gap));
  const right = gap === -1 ? [] : hextets(ip.slice(gap + 2));
  const groups = [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const [high = 0, low = 0] = groups.slice(6);
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  }
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(':')}::/64`;
}

/**
 * Per-network counter for this UTC day (see `ipNetwork`). The address is never stored: it is an HMAC
 * keyed by a server secret (TRY_IP_SALT, else the Supabase service-role key) over the day and the
 * network, so the same network has an unrelated key each day.
 */
export function trialIpKey(ip: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const secret = process.env.TRY_IP_SALT?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || 'unvibe-trial-ip';
  const hash = createHmac('sha256', secret).update(`unvibe-trial-ip:${day}:${ipNetwork(ip)}`).digest('hex').slice(0, 32);
  return `__ip__:${day}:${hash}`;
}

/** True for a real install's counter row, false for the shared per-IP and global rows. */
export function isInstallCounterKey(key: string): boolean {
  return /^[0-9a-f]{64}$/.test(key);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Stable opaque key derived from the install id (never store the raw id alone as PK). */
export function trialInstallKey(installId: string): string {
  return createHash('sha256').update(`unvibe-trial-install:${installId}`).digest('hex');
}

/** Validate Bearer trial token + install header. Returns install key or null. */
export function trialInstallFromRequest(req: Request): string | null {
  const secret = trialSecret();
  if (!secret) return null;
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token || !safeEqual(token, secret)) return null;
  const installId = req.headers.get('x-unvibe-install-id')?.trim() ?? '';
  if (!INSTALL_ID_RE.test(installId)) return null;
  return trialInstallKey(installId);
}

function memoryBucket(): Map<string, TrialCounter> {
  const g = globalThis as unknown as { __unvibeTrialUsage?: Map<string, TrialCounter> };
  g.__unvibeTrialUsage ??= new Map();
  return g.__unvibeTrialUsage;
}

function installMemoryBucket(): Map<string, TrialInstallRecord> {
  const g = globalThis as unknown as { __unvibeTrialInstalls?: Map<string, TrialInstallRecord> };
  g.__unvibeTrialInstalls ??= new Map();
  return g.__unvibeTrialInstalls;
}

function memoryKey(installKey: string, kind: TrialKind): string {
  return `${installKey}:${kind}`;
}

/** Create the install record on first use (write-once), then return its start time. */
async function readInstall(installKey: string, now = new Date()): Promise<TrialInstallRecord> {
  const db = serviceSupabase();
  if (!db) {
    const bucket = installMemoryBucket();
    let record = bucket.get(installKey);
    if (!record) {
      record = { startedAt: now.toISOString() };
      bucket.set(installKey, record);
    }
    return record;
  }
  const { error: writeError } = await db
    .from('trial_installs')
    .upsert({ install_key: installKey, started_at: now.toISOString() }, { onConflict: 'install_key', ignoreDuplicates: true });
  if (writeError) console.error('trial install record write failed', writeError.message);
  const { data, error } = await db.from('trial_installs').select('started_at').eq('install_key', installKey).maybeSingle();
  if (error) console.error('trial install record read failed', error.message);
  const startedAt = typeof data?.started_at === 'string' ? data.started_at : now.toISOString();
  return { startedAt };
}

async function readUsed(installKey: string, kind: TrialKind): Promise<number> {
  const db = serviceSupabase();
  if (!db) return memoryBucket().get(memoryKey(installKey, kind))?.used ?? 0;
  const { data, error } = await db
    .from('trial_counters')
    .select('used')
    .eq('install_key', installKey)
    .eq('kind', kind)
    .maybeSingle();
  if (error) {
    console.error('trial usage read failed', error.message);
    return 0;
  }
  return Number(data?.used ?? 0);
}

/**
 * Atomically add one use when under `limit`. Returns the new count, -1 when the limit is reached,
 * or null when storage failed (logged; the caller refuses the request).
 */
async function reserveUnit(installKey: string, kind: TrialKind, limit: number): Promise<number | null> {
  const db = serviceSupabase();
  if (!db) {
    const bucket = memoryBucket();
    const key = memoryKey(installKey, kind);
    const used = bucket.get(key)?.used ?? 0;
    if (used >= limit) return -1;
    bucket.set(key, { used: used + 1 });
    return used + 1;
  }
  const { data, error } = await db.rpc('trial_reserve', { p_install_key: installKey, p_kind: kind, p_limit: limit });
  if (error) {
    console.error('trial usage reserve failed', error.message);
    return null;
  }
  return typeof data === 'number' && Number.isInteger(data) ? data : null;
}

/** Compare-and-swap decrement of one counter; never below zero, never overwrites a concurrent reservation. */
async function releaseUnit(installKey: string, kind: TrialKind): Promise<void> {
  const db = serviceSupabase();
  if (!db) {
    const bucket = memoryBucket();
    const key = memoryKey(installKey, kind);
    const used = bucket.get(key)?.used ?? 0;
    if (used > 0) bucket.set(key, { used: used - 1 });
    return;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const used = await readUsed(installKey, kind);
    if (used <= 0) return;
    const { data, error } = await db
      .from('trial_counters')
      .update({ used: used - 1, updated_at: new Date().toISOString() })
      .eq('install_key', installKey)
      .eq('kind', kind)
      .eq('used', used)
      .select('used');
    if (error) throw new Error(`trial usage release failed: ${error.message}`);
    if (Array.isArray(data) && data.length > 0) return;
  }
  throw new Error('trial usage release failed: counter kept changing');
}

export async function trialUsageLine(installKey: string, kind: TrialKind, now = new Date()): Promise<TrialUsageLine> {
  const record = await readInstall(installKey, now);
  const { expiresAt, expired } = trialWindow(record.startedAt, now);
  const limit = limitFor(kind);
  const used = await readUsed(installKey, kind);
  return { kind, used, limit, remaining: expired ? 0 : Math.max(0, limit - used), resetsAt: expiresAt };
}

export async function trialUsageOverview(installKey: string, now = new Date()): Promise<{
  plan: 'trial';
  usage: TrialUsageLine[];
}> {
  const kinds: TrialKind[] = ['ai_explanation', 'project_question'];
  return { plan: 'trial', usage: await Promise.all(kinds.map((kind) => trialUsageLine(installKey, kind, now))) };
}

/** Read one shared per-IP or global counter (see the key helpers above). */
export async function trialCounterUsed(key: string): Promise<number> {
  return readUsed(key, SHARED_COUNTER_KIND);
}

export type TrialReservation =
  | { denied: Response; release?: undefined }
  | { denied: null; release: () => Promise<void> };

interface TrialUnit {
  key: string;
  kind: TrialKind;
}

/** Best effort: give units back by compare-and-swap; a failed give-back is logged and leaves an over-count. */
async function releaseUnits(units: TrialUnit[]): Promise<void> {
  await Promise.all(units.map((unit) => releaseUnit(unit.key, unit.kind).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
  })));
}

const STORE_UNAVAILABLE = {
  status: 503,
  error: 'trial_unavailable',
  message: 'The free beta could not check its allowance just now. Please try again in a few minutes.',
};

/**
 * Consume one trial unit for `installKey`, then one each from the caller's per-IP daily counter and
 * the global monthly and daily counters. On refusal (429 over a limit, 503 when a counter could not
 * be reserved) every unit already taken is given back. Otherwise `release` gives all of them back,
 * for when the AI produced nothing.
 */
export async function reserveTrialAction(
  installKey: string,
  kind: TrialKind,
  ip: string,
  now = new Date(),
): Promise<TrialReservation> {
  const record = await readInstall(installKey, now);
  const { expiresAt, expired } = trialWindow(record.startedAt, now);
  const limit = limitFor(kind);
  if (expired) {
    const used = await readUsed(installKey, kind);
    return { denied: Response.json({
      error: 'plan_limit_reached',
      message: `Your 30-day public-beta access ended on ${new Date(expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`,
      usage: { kind, used, limit, remaining: 0, resetsAt: expiresAt }, upgradePath: '/plan',
    }, { status: 429 }) };
  }

  const reserved = await reserveUnit(installKey, kind, limit);
  if (reserved === null) {
    return { denied: Response.json({ error: STORE_UNAVAILABLE.error, message: STORE_UNAVAILABLE.message }, { status: 503 }) };
  }
  if (reserved === -1) {
    const used = await readUsed(installKey, kind);
    return { denied: Response.json({
      error: 'plan_limit_reached',
      message: `This 30-day beta includes ${limit} ${kind === 'ai_explanation' ? 'AI explanations' : 'follow-up questions'}.`,
      usage: { kind, used, limit, remaining: 0, resetsAt: expiresAt }, upgradePath: '/plan',
    }, { status: 429 }) };
  }

  const shared = [
    {
      key: trialIpKey(ip, now),
      limit: limitFromEnv('UNVIBE_TRIAL_IP_DAILY_LIMIT', 150),
      error: 'trial_network_limit',
      message: 'This network has used today\'s free beta explanations. Try again tomorrow, sign in, or add your own API key in Settings.',
    },
    {
      key: trialGlobalMonthKey(now),
      limit: limitFromEnv('UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT', 50_000),
      error: 'trial_capacity_reached',
      message: 'The public-beta allowance is temporarily full. Please try again later or add your own API key in Settings.',
    },
    {
      key: trialGlobalDayKey(now),
      limit: limitFromEnv('UNVIBE_TRIAL_GLOBAL_DAILY_LIMIT', 2_000),
      error: 'trial_capacity_reached',
      message: 'The free beta has reached today\'s limit for everyone. Please try again tomorrow or add your own API key in Settings.',
    },
  ];
  const results = await Promise.all(shared.map((counter) => reserveUnit(counter.key, SHARED_COUNTER_KIND, counter.limit)));
  const taken: TrialUnit[] = [{ key: installKey, kind }];
  shared.forEach((counter, i) => {
    if (results[i] !== null && results[i] !== -1) taken.push({ key: counter.key, kind: SHARED_COUNTER_KIND });
  });
  const full = shared.find((_, i) => results[i] === -1);
  const refusal = full ? { status: 429, error: full.error, message: full.message } : results.includes(null) ? STORE_UNAVAILABLE : null;
  if (refusal) {
    await releaseUnits(taken);
    return { denied: Response.json({ error: refusal.error, message: refusal.message }, { status: refusal.status }) };
  }
  return { denied: null, release: () => releaseUnits(taken) };
}
