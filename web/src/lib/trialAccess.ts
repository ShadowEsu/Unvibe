/**
 * Sealed desktop trial access. The shared trial token is NOT a provider API key —
 * Gemini/Anthropic keys stay server-side. Each install receives a hard 30-day AI and follow-up budget.
 *
 * Durable counters live in Supabase (trial_installs / trial_counters, atomic trial_reserve RPC).
 * Process memory is used only when Supabase is not configured (dev/tests).
 */
import { createHash, timingSafeEqual } from 'node:crypto';
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
const GLOBAL_INSTALL_KEY = '__global__';

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

function explanationLimit(): number {
  const n = Number(process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT ?? '50');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}

function questionLimit(): number {
  const n = Number(process.env.UNVIBE_TRIAL_FOLLOW_UP_LIMIT ?? '50');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}

function globalLimit(): number {
  const n = Number(process.env.UNVIBE_TRIAL_GLOBAL_LIMIT ?? '50000');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50_000;
}

function limitFor(kind: TrialKind): number {
  return kind === 'ai_explanation' ? explanationLimit() : questionLimit();
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
 * or null when storage failed (logged; the request is allowed rather than blocked by an outage).
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
  return Number(data);
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

/**
 * Consume one trial unit. Returns a 429 Response when denied, otherwise null.
 * Also enforces a shared global monthly ceiling across all trial installs.
 */
export async function reserveTrialAction(
  installKey: string,
  kind: TrialKind,
  now = new Date(),
): Promise<Response | null> {
  const record = await readInstall(installKey, now);
  const { expiresAt, expired } = trialWindow(record.startedAt, now);
  const limit = limitFor(kind);
  if (expired) {
    const used = await readUsed(installKey, kind);
    return Response.json({
      error: 'plan_limit_reached',
      message: `Your 30-day public-beta access ended on ${new Date(expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`,
      usage: { kind, used, limit, remaining: 0, resetsAt: expiresAt }, upgradePath: '/plan',
    }, { status: 429 });
  }

  const reserved = await reserveUnit(installKey, kind, limit);
  if (reserved === -1) {
    const used = await readUsed(installKey, kind);
    return Response.json({
      error: 'plan_limit_reached',
      message: `This 30-day beta includes ${limit} ${kind === 'ai_explanation' ? 'AI explanations' : 'follow-up questions'}.`,
      usage: { kind, used, limit, remaining: 0, resetsAt: expiresAt }, upgradePath: '/plan',
    }, { status: 429 });
  }

  if (kind === 'ai_explanation' && (await reserveUnit(GLOBAL_INSTALL_KEY, kind, globalLimit())) === -1) {
    // The per-install unit stays spent: a rare over-count beats a non-atomic give-back.
    const used = reserved ?? (await readUsed(installKey, kind));
    return Response.json({
      error: 'plan_limit_reached',
      message: 'The public-beta allowance is temporarily full. Please try again later or add your own API key in Settings.',
      usage: { kind, used, limit, remaining: Math.max(0, limit - used), resetsAt: expiresAt }, upgradePath: '/plan',
    }, { status: 429 });
  }
  return null;
}
