/**
 * Sealed desktop trial access. The shared trial token is NOT a provider API key —
 * Gemini/Anthropic keys stay server-side. Each install receives a hard 30-day AI and follow-up budget.
 *
 * Durable counters prefer Vercel Blob (cross-instance). Falls back to process memory.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { head, put } from '@vercel/blob';
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

function blobPath(installKey: string, kind: TrialKind): string {
  return `trial-usage/v2/${kind}/${installKey}.json`;
}

function installBlobPath(installKey: string): string {
  return `trial-usage/v2/installs/${installKey}.json`;
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

async function readInstall(installKey: string, now = new Date()): Promise<TrialInstallRecord> {
  const mem = installMemoryBucket().get(installKey);
  if (mem) return mem;
  const token = blobToken();
  if (token) {
    try {
      const meta = await head(installBlobPath(installKey), { token });
      const response = await fetch(meta.url, { headers: { authorization: `Bearer ${token}` } });
      if (response.ok) {
        const body = (await response.json().catch(() => null)) as TrialInstallRecord | null;
        if (body?.startedAt && !Number.isNaN(new Date(body.startedAt).getTime())) {
          installMemoryBucket().set(installKey, body);
          return body;
        }
      }
    } catch {
      // First-use records do not exist yet; create one below.
    }
  }
  const record = { startedAt: now.toISOString() };
  installMemoryBucket().set(installKey, record);
  if (token) {
    try {
      await put(installBlobPath(installKey), JSON.stringify(record), {
        access: 'private', addRandomSuffix: false, allowOverwrite: false,
        contentType: 'application/json', token,
      });
    } catch {
      // A concurrent first request may have created the same record. The next read converges.
    }
  }
  return record;
}

async function readUsed(installKey: string, kind: TrialKind): Promise<number> {
  const mem = memoryBucket().get(memoryKey(installKey, kind));
  const token = blobToken();
  if (!token) return mem?.used ?? 0;
  try {
    const meta = await head(blobPath(installKey, kind), { token });
    const response = await fetch(meta.url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return mem?.used ?? 0;
    const body = (await response.json().catch(() => null)) as TrialCounter | null;
    const used = Number(body?.used ?? mem?.used ?? 0);
    memoryBucket().set(memoryKey(installKey, kind), { used });
    return used;
  } catch {
    return mem?.used ?? 0;
  }
}

async function writeUsed(installKey: string, kind: TrialKind, used: number): Promise<void> {
  memoryBucket().set(memoryKey(installKey, kind), { used });
  const token = blobToken();
  if (!token) return;
  try {
    await put(blobPath(installKey, kind), JSON.stringify({ used, updatedAt: new Date().toISOString() }), {
      access: 'private', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/json', token,
    });
  } catch {
    // Memory counter still applies for this instance.
  }
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
  const used = await readUsed(installKey, kind);
  if (expired) {
    return Response.json({
      error: 'plan_limit_reached',
      message: `Your 30-day public-beta access ended on ${new Date(expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`,
      usage: { kind, used, limit, remaining: 0, resetsAt: expiresAt }, upgradePath: '/plan',
    }, { status: 429 });
  }
  if (used >= limit) {
    return Response.json({
      error: 'plan_limit_reached',
      message: `This 30-day beta includes ${limit} ${kind === 'ai_explanation' ? 'AI explanations' : 'follow-up questions'}.`,
      usage: { kind, used, limit, remaining: 0, resetsAt: expiresAt }, upgradePath: '/plan',
    }, { status: 429 });
  }

  if (kind === 'ai_explanation') {
    const globalUsed = await readUsed(GLOBAL_INSTALL_KEY, kind);
    if (globalUsed >= globalLimit()) {
      return Response.json({
        error: 'plan_limit_reached',
        message: 'The public-beta allowance is temporarily full. Please try again later or add your own API key in Settings.',
        usage: { kind, used, limit, remaining: Math.max(0, limit - used), resetsAt: expiresAt }, upgradePath: '/plan',
      }, { status: 429 });
    }
    await writeUsed(GLOBAL_INSTALL_KEY, kind, globalUsed + 1);
  }

  await writeUsed(installKey, kind, used + 1);
  return null;
}
