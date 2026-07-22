/**
 * Sealed desktop trial access. The shared trial token is NOT a provider API key —
 * Gemini/Anthropic keys stay server-side. Each install gets a hard monthly AI budget.
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

const INSTALL_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const GLOBAL_INSTALL_KEY = '__global__';

function monthWindow(now = new Date()): { period: string; resetsAt: string } {
  const starts = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { period: starts.toISOString().slice(0, 7), resetsAt: resets.toISOString() };
}

function trialSecret(): string | null {
  const value = process.env.UNVIBE_TRIAL_TOKEN?.trim();
  return value || null;
}

function explanationLimit(): number {
  const n = Number(process.env.UNVIBE_TRIAL_MONTHLY_LIMIT ?? '20');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}

function quizLimit(): number {
  const n = Number(process.env.UNVIBE_TRIAL_QUIZ_LIMIT ?? '5');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

function globalMonthlyLimit(): number {
  const n = Number(process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT ?? '400');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 400;
}

function limitFor(kind: TrialKind): number {
  return kind === 'ai_explanation' ? explanationLimit() : quizLimit();
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

function memoryBucket(): Map<string, number> {
  const g = globalThis as unknown as { __unvibeTrialUsage?: Map<string, number> };
  g.__unvibeTrialUsage ??= new Map();
  return g.__unvibeTrialUsage;
}

function memoryKey(installKey: string, period: string, kind: TrialKind): string {
  return `${installKey}:${period}:${kind}`;
}

function blobPath(installKey: string, period: string, kind: TrialKind): string {
  return `trial-usage/${period}/${kind}/${installKey}.json`;
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

async function readUsed(installKey: string, period: string, kind: TrialKind): Promise<number> {
  const mem = memoryBucket().get(memoryKey(installKey, period, kind));
  const token = blobToken();
  if (!token) return mem ?? 0;
  try {
    const meta = await head(blobPath(installKey, period, kind), { token });
    const res = await fetch(meta.url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return mem ?? 0;
    const body = (await res.json().catch(() => null)) as { used?: number } | null;
    return Number(body?.used ?? mem ?? 0);
  } catch {
    return mem ?? 0;
  }
}

async function writeUsed(installKey: string, period: string, kind: TrialKind, used: number): Promise<void> {
  memoryBucket().set(memoryKey(installKey, period, kind), used);
  const token = blobToken();
  if (!token) return;
  try {
    await put(blobPath(installKey, period, kind), JSON.stringify({ used, updatedAt: new Date().toISOString() }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token,
    });
  } catch {
    // Memory counter still applies for this instance.
  }
}

export async function trialUsageLine(installKey: string, kind: TrialKind, now = new Date()): Promise<TrialUsageLine> {
  const { period, resetsAt } = monthWindow(now);
  const limit = limitFor(kind);
  const used = await readUsed(installKey, period, kind);
  return {
    kind,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt,
  };
}

export async function trialUsageOverview(installKey: string, now = new Date()): Promise<{
  plan: 'trial';
  usage: TrialUsageLine[];
}> {
  const kinds: TrialKind[] = ['ai_explanation', 'project_question'];
  return {
    plan: 'trial',
    usage: await Promise.all(kinds.map((kind) => trialUsageLine(installKey, kind, now))),
  };
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
  const { period, resetsAt } = monthWindow(now);
  const limit = limitFor(kind);
  const used = await readUsed(installKey, period, kind);
  if (used >= limit) {
    return Response.json(
      {
        error: 'plan_limit_reached',
        message: `This trial build has reached its monthly ${kind === 'ai_explanation' ? 'explanation' : 'quiz'} limit (${limit}). Resets on ${new Date(resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`,
        usage: { kind, used, limit, remaining: 0, resetsAt },
        upgradePath: '/plan',
      },
      { status: 429 },
    );
  }

  if (kind === 'ai_explanation') {
    const globalLimit = globalMonthlyLimit();
    const globalUsed = await readUsed(GLOBAL_INSTALL_KEY, period, kind);
    if (globalUsed >= globalLimit) {
      return Response.json(
        {
          error: 'plan_limit_reached',
          message: 'The shared trial allowance is exhausted for this month. Sign in for a personal Free plan, or add your own API key in Settings.',
          usage: { kind, used, limit, remaining: Math.max(0, limit - used), resetsAt },
          upgradePath: '/plan',
        },
        { status: 429 },
      );
    }
    await writeUsed(GLOBAL_INSTALL_KEY, period, kind, globalUsed + 1);
  }

  await writeUsed(installKey, period, kind, used + 1);
  return null;
}
