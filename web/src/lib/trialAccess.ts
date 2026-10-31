/**
 * Sealed desktop trial access. The shared trial token is NOT a provider API key —
 * Anthropic keys stay server-side. Each install receives a hard 30-day AI and follow-up budget.
 *
 * The token ships in the app and install ids are chosen by the client, so per-install counters alone
 * do not bound spend. Every trial AI request also counts against:
 * - its network: `__ip__:YYYY-MM-DD:<hmac of the IP>`, UNVIBE_TRIAL_IP_DAILY_LIMIT (default 150, a classroom NAT);
 * - everyone this month: `__global__:YYYY-MM`, UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT (default 50,000);
 * - everyone today: `__global_day__:YYYY-MM-DD`, UNVIBE_TRIAL_GLOBAL_DAILY_LIMIT (default 2,000).
 * Periods are UTC. If any counter cannot be reserved the request is refused (503), never allowed.
 *
 * AI cost is measured by two more shared rows per UTC day and kind, `__tokens_in__:YYYY-MM-DD` and
 * `__tokens_out__:YYYY-MM-DD`: provider-reported token totals for all trial requests, never per
 * install and never text (`recordTrialTokens`). chars/4 estimates (the provider accepted the request but
 * reported no usage, e.g. a cut-off stream) go to `__tokens_est_in__` / `__tokens_est_out__`, so
 * measured and estimated totals are never blended.
 *
 * Durable counters live in Supabase (trial_installs / trial_counters, atomic trial_reserve RPC).
 * Process memory is used only when Supabase is not configured (dev/tests).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIPv6 } from 'node:net';
import { serviceSupabase } from '@/lib/serviceSupabase';
import type { UsageKind } from '@/billing/types';
import type { TokenUsage } from '@/ai/provider';

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

/**
 * What an install reports about itself on its first online launch (A-spec A1): OS family and the app
 * version it started on. Stored on insert only, so a later update never rewrites them. Each is null
 * unless it is exactly `mac`/`win` or a plain `x.y.z` version.
 */
export interface TrialInstallMeta {
  platform: 'mac' | 'win' | null;
  firstVersion: string | null;
}

const NO_META: TrialInstallMeta = { platform: null, firstVersion: null };
const VERSION_RE = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,4}$/;

/** Parse `x-unvibe-platform` and `x-unvibe-version`; anything else becomes null. */
export function trialInstallMeta(req: Request): TrialInstallMeta {
  const platform = req.headers.get('x-unvibe-platform')?.trim() ?? '';
  const version = req.headers.get('x-unvibe-version')?.trim() ?? '';
  return {
    platform: platform === 'mac' || platform === 'win' ? platform : null,
    firstVersion: VERSION_RE.test(version) ? version : null,
  };
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

let localIpKey: string | undefined;

/**
 * Per-network counter for this UTC day (see `ipNetwork`). The address is never stored: it is an HMAC
 * keyed by a server secret (TRY_IP_SALT, else the Supabase service-role key) over the day and the
 * network, so the same network has an unrelated key each day. Production with neither secret returns
 * null (callers answer 503); outside production a random per-process key stands in. Never a public
 * constant: with a known key the hashes could be brute-forced back to addresses.
 */
export function trialIpKey(ip: string, now = new Date()): string | null {
  const day = now.toISOString().slice(0, 10);
  const secret = process.env.TRY_IP_SALT?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret && process.env.NODE_ENV === 'production') return null;
  const key = secret || (localIpKey ??= randomBytes(32).toString('hex'));
  const hash = createHmac('sha256', key).update(`unvibe-trial-ip:${day}:${ipNetwork(ip)}`).digest('hex').slice(0, 32);
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

/**
 * Validate Bearer trial token + install header. Returns the raw install id or null. Callers must
 * hash it before storing it (`trialInstallKey`, or a feature-specific prefix like the PMF survey).
 */
export function trialInstallIdFromRequest(req: Request): string | null {
  const secret = trialSecret();
  if (!secret) return null;
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token || !safeEqual(token, secret)) return null;
  const installId = req.headers.get('x-unvibe-install-id')?.trim() ?? '';
  return INSTALL_ID_RE.test(installId) ? installId : null;
}

/** Validate Bearer trial token + install header. Returns install key or null. */
export function trialInstallFromRequest(req: Request): string | null {
  const installId = trialInstallIdFromRequest(req);
  return installId ? trialInstallKey(installId) : null;
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

/** Create the install record on first use (write-once, with `meta`), then return its start time. */
async function readInstall(installKey: string, now = new Date(), meta: TrialInstallMeta = NO_META): Promise<TrialInstallRecord> {
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
  const row = { install_key: installKey, started_at: now.toISOString() };
  // Until 20261025120000_trial_funnel.sql is applied, platform and first_version do not exist and an
  // insert naming them fails. The install row itself (the trial clock) must still be created.
  const attempts = meta.platform !== null || meta.firstVersion !== null
    ? [{ ...row, platform: meta.platform, first_version: meta.firstVersion }, row]
    : [row];
  for (const values of attempts) {
    const { error: writeError } = await db.from('trial_installs').upsert(values, { onConflict: 'install_key', ignoreDuplicates: true });
    if (!writeError) break;
    console.error('trial install record write failed', writeError.message);
  }
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

/** Compare-and-swap add of `amount` to one counter, creating it at zero first. */
async function addToCounter(key: string, kind: TrialKind, amount: number): Promise<void> {
  const db = serviceSupabase();
  if (!db) {
    const bucket = memoryBucket();
    const memory = memoryKey(key, kind);
    bucket.set(memory, { used: (bucket.get(memory)?.used ?? 0) + amount });
    return;
  }
  const { error: createError } = await db
    .from('trial_counters')
    .upsert({ install_key: key, kind, used: 0 }, { onConflict: 'install_key,kind', ignoreDuplicates: true });
  if (createError) throw new Error(`trial token counter create failed: ${createError.message}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const used = await readUsed(key, kind);
    const { data, error } = await db
      .from('trial_counters')
      .update({ used: used + amount, updated_at: new Date().toISOString() })
      .eq('install_key', key)
      .eq('kind', kind)
      .eq('used', used)
      .select('used');
    if (error) throw new Error(`trial token counter update failed: ${error.message}`);
    if (Array.isArray(data) && data.length > 0) return;
  }
  throw new Error('trial token counter update failed: counter kept changing');
}

function trialTokenKeys(now: Date, estimated: boolean): { input: string; output: string } {
  const day = now.toISOString().slice(0, 10);
  return estimated
    ? { input: `__tokens_est_in__:${day}`, output: `__tokens_est_out__:${day}` }
    : { input: `__tokens_in__:${day}`, output: `__tokens_out__:${day}` };
}

/**
 * Best effort: add one trial request's token counts to today's totals for its kind, on the
 * estimate rows when `usage.estimated`. Never fails the request.
 */
export async function recordTrialTokens(kind: TrialKind, usage: TokenUsage, now = new Date()): Promise<void> {
  const keys = trialTokenKeys(now, usage.estimated === true);
  await Promise.all([
    usage.inputTokens > 0 ? addToCounter(keys.input, kind, usage.inputTokens) : undefined,
    usage.outputTokens > 0 ? addToCounter(keys.output, kind, usage.outputTokens) : undefined,
  ]).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
  });
}

/** Today's (UTC) trial token totals for one kind: measured by default, or the estimate rows. */
export async function trialDailyTokens(
  kind: TrialKind,
  { estimated = false, now = new Date() }: { estimated?: boolean; now?: Date } = {},
): Promise<{ inputTokens: number; outputTokens: number }> {
  const keys = trialTokenKeys(now, estimated);
  const [inputTokens, outputTokens] = await Promise.all([readUsed(keys.input, kind), readUsed(keys.output, kind)]);
  return { inputTokens, outputTokens };
}

export async function trialUsageLine(installKey: string, kind: TrialKind, now = new Date(), meta: TrialInstallMeta = NO_META): Promise<TrialUsageLine> {
  const record = await readInstall(installKey, now, meta);
  const { expiresAt, expired } = trialWindow(record.startedAt, now);
  const limit = limitFor(kind);
  const used = await readUsed(installKey, kind);
  return { kind, used, limit, remaining: expired ? 0 : Math.max(0, limit - used), resetsAt: expiresAt };
}

export async function trialUsageOverview(installKey: string, now = new Date(), meta: TrialInstallMeta = NO_META): Promise<{
  plan: 'trial';
  usage: TrialUsageLine[];
}> {
  const kinds: TrialKind[] = ['ai_explanation', 'project_question'];
  return { plan: 'trial', usage: await Promise.all(kinds.map((kind) => trialUsageLine(installKey, kind, now, meta))) };
}

/** Read one shared per-IP or global counter (see the key helpers above). */
export async function trialCounterUsed(key: string): Promise<number> {
  return readUsed(key, SHARED_COUNTER_KIND);
}

/** `startedAt` is the install's first online launch, for the `return` marker (see activation.ts). */
export type TrialReservation =
  | { denied: Response; release?: undefined; startedAt?: undefined }
  | { denied: null; release: () => Promise<void>; startedAt: string };

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
 * be reserved, or in production without a secret for the per-IP key) every unit already taken is
 * given back: no AI call was made. Otherwise `release`, for
 * when the AI produced nothing, gives back only the install unit. The per-IP and global counters are
 * spend meters: the provider call has started and is billed, so failed, empty, blocked or aborted
 * answers stay on them, or retrying such requests would make every cap free.
 */
export async function reserveTrialAction(
  installKey: string,
  kind: TrialKind,
  ip: string,
  now = new Date(),
  meta: TrialInstallMeta = NO_META,
): Promise<TrialReservation> {
  const record = await readInstall(installKey, now, meta);
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

  // The per-IP key needs a server secret; without one, production refuses before any unit is taken.
  const ipKey = trialIpKey(ip, now);
  if (!ipKey) {
    console.error('TRIAL_IP_KEY_UNCONFIGURED: set TRY_IP_SALT or SUPABASE_SERVICE_ROLE_KEY; trial requests answer 503');
    return { denied: Response.json({ error: STORE_UNAVAILABLE.error, message: STORE_UNAVAILABLE.message }, { status: 503 }) };
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
      key: ipKey,
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
  return { denied: null, release: () => releaseUnits([{ key: installKey, kind }]), startedAt: record.startedAt };
}

/**
 * Rate limit for `POST /api/v1/trial/progress`, built like the per-IP cap on trial AI requests: one
 * shared counter per network per UTC day, `__progress_ip__:YYYY-MM-DD:<hmac>` (UNVIBE_TRIAL_PROGRESS_IP_DAILY_LIMIT,
 * default 500; a classroom NAT setting up 30 installs sends at most about 300 pings). The address is
 * never stored. Returns 'ok', 'limited' (429) or 'unavailable' (storage failed, or production has no
 * secret for the per-IP key; 503).
 */
export async function reserveTrialProgressPing(ip: string, now = new Date()): Promise<'ok' | 'limited' | 'unavailable'> {
  const ipKey = trialIpKey(ip, now);
  if (!ipKey) return 'unavailable';
  const key = ipKey.replace(/^__ip__:/, '__progress_ip__:');
  const reserved = await reserveUnit(key, SHARED_COUNTER_KIND, limitFromEnv('UNVIBE_TRIAL_PROGRESS_IP_DAILY_LIMIT', 500));
  if (reserved === null) return 'unavailable';
  return reserved === -1 ? 'limited' : 'ok';
}
