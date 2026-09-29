/**
 * Aggregate desktop install counts for the founder dashboard.
 * Counts only. It never returns install keys, emails, code, or prompts.
 */
import { timingSafeEqual } from 'node:crypto';
import { list } from '@vercel/blob';

export interface BlobEntry {
  pathname: string;
  uploadedAt: Date;
}

export interface InstallStats {
  /** Installs that have made at least one trial AI request, all time. */
  installs: number;
  newToday: number;
  new7d: number;
  new30d: number;
  /** Installs whose explanation counter changed in the window (a proxy for active users). */
  active7d: number;
  active30d: number;
  source: 'blob' | 'unavailable';
  generatedAt: string;
}

const INSTALLS_PREFIX = 'trial-usage/v2/installs/';
const EXPLANATIONS_PREFIX = 'trial-usage/v2/ai_explanation/';
const DAY_MS = 86_400_000;

/** True when the bearer token matches UNVIBE_ADMIN_STATS_TOKEN. Fails closed when unset. */
export function isAdminStatsRequest(req: Request, secret = process.env.UNVIBE_ADMIN_STATS_TOKEN?.trim()): boolean {
  if (!secret || secret.length < 24) return false;
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  const token = match?.[1]?.trim() ?? '';
  const left = Buffer.from(token);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Pure counting over blob listings so it can be unit tested without storage. */
export function summarizeInstalls(installs: BlobEntry[], explanations: BlobEntry[], now = new Date()): Omit<InstallStats, 'source' | 'generatedAt'> {
  const since = (days: number) => now.getTime() - days * DAY_MS;
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const after = (items: BlobEntry[], ms: number) => items.filter((item) => item.uploadedAt.getTime() >= ms).length;
  return {
    installs: installs.length,
    newToday: after(installs, startOfDay.getTime()),
    new7d: after(installs, since(7)),
    new30d: after(installs, since(30)),
    active7d: after(explanations, since(7)),
    active30d: after(explanations, since(30)),
  };
}

async function listAll(prefix: string, token: string): Promise<BlobEntry[]> {
  const out: BlobEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000, token });
    for (const blob of page.blobs) out.push({ pathname: blob.pathname, uploadedAt: new Date(blob.uploadedAt) });
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export async function installStats(now = new Date()): Promise<InstallStats> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const generatedAt = now.toISOString();
  if (!token) {
    return { installs: 0, newToday: 0, new7d: 0, new30d: 0, active7d: 0, active30d: 0, source: 'unavailable', generatedAt };
  }
  const [installs, explanations] = await Promise.all([listAll(INSTALLS_PREFIX, token), listAll(EXPLANATIONS_PREFIX, token)]);
  return { ...summarizeInstalls(installs, explanations, now), source: 'blob', generatedAt };
}
