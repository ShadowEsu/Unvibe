/**
 * Lightweight site traffic counters (page views + unique visitors).
 * Stored in Vercel Blob when configured, otherwise .data/site-stats.json locally.
 * Visitor ids are hashed before persistence — no emails or code.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { list, put } from "@vercel/blob";

interface DayBucket {
  views: number;
  uniques: number;
  ids: string[];
}

interface StatsFile {
  totalViews: number;
  totalUniques: number;
  seenIds: string[];
  days: Record<string, DayBucket>;
}

export interface SiteStatsSummary {
  today: { views: number; visitors: number; date: string };
  week: { views: number; visitors: number };
  allTime: { views: number; visitors: number };
  recentDays: Array<{ date: string; views: number; visitors: number }>;
}

const BLOB_PATH = "stats/site.v1.json";
const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "site-stats.json");
const MAX_DAY_IDS = 5_000;
const MAX_SEEN_IDS = 50_000;
const KEEP_DAY_DETAIL = 120;

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("Durable stats storage is not configured");
  return token;
}

function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function emptyStats(): StatsFile {
  return { totalViews: 0, totalUniques: 0, seenIds: [], days: {} };
}

function hashVisitor(visitorId: string): string {
  const salt = process.env.WAITLIST_ADMIN_TOKEN?.trim() || "local-dev";
  return createHash("sha256").update(`${salt}:visit:${visitorId}`).digest("hex").slice(0, 24);
}

function ensureDay(data: StatsFile, key: string): DayBucket {
  if (!data.days[key]) data.days[key] = { views: 0, uniques: 0, ids: [] };
  return data.days[key]!;
}

function prune(data: StatsFile): void {
  if (data.seenIds.length > MAX_SEEN_IDS) {
    data.seenIds = data.seenIds.slice(data.seenIds.length - MAX_SEEN_IDS);
  }
  const keys = Object.keys(data.days).sort();
  if (keys.length <= KEEP_DAY_DETAIL) return;
  const drop = keys.slice(0, keys.length - KEEP_DAY_DETAIL);
  for (const key of drop) {
    const day = data.days[key];
    if (!day) continue;
    data.days[key] = { views: day.views, uniques: day.uniques, ids: [] };
  }
}

function normalize(parsed: Partial<StatsFile> | null | undefined): StatsFile {
  return {
    totalViews: Number(parsed?.totalViews) || 0,
    totalUniques: Number(parsed?.totalUniques) || 0,
    seenIds: Array.isArray(parsed?.seenIds) ? parsed.seenIds.filter((id): id is string => typeof id === "string") : [],
    days: parsed?.days && typeof parsed.days === "object" ? parsed.days : {},
  };
}

async function readLocal(): Promise<StatsFile> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    return normalize(JSON.parse(raw) as StatsFile);
  } catch {
    return emptyStats();
  }
}

async function writeLocal(data: StatsFile): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(data), "utf8");
}

async function readBlob(): Promise<StatsFile> {
  const token = blobToken();
  const page = await list({ prefix: BLOB_PATH, limit: 1, token });
  const match = page.blobs.find((b) => b.pathname === BLOB_PATH);
  if (!match) return emptyStats();
  const url = new URL(match.url);
  url.searchParams.set("download", "1");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
    cache: "no-store",
  });
  if (response.status === 404) return emptyStats();
  if (!response.ok) throw new Error("Stats storage returned an unexpected response");
  return normalize((await response.json()) as StatsFile);
}

async function writeBlob(data: StatsFile): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
    token: blobToken(),
  });
}

async function load(): Promise<StatsFile> {
  return blobConfigured() ? readBlob() : readLocal();
}

async function save(data: StatsFile): Promise<void> {
  prune(data);
  if (blobConfigured()) await writeBlob(data);
  else await writeLocal(data);
}

function lastNDates(n: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

function summarize(data: StatsFile): SiteStatsSummary {
  const todayKey = dayKey();
  const today = data.days[todayKey] ?? { views: 0, uniques: 0, ids: [] };
  const weekKeys = lastNDates(7);
  let weekViews = 0;
  const weekIds = new Set<string>();
  let weekUniqueFallback = 0;
  for (const key of weekKeys) {
    const day = data.days[key];
    if (!day) continue;
    weekViews += day.views;
    weekUniqueFallback += day.uniques;
    for (const id of day.ids) weekIds.add(id);
  }

  const recentDays = lastNDates(14).map((date) => ({
    date,
    views: data.days[date]?.views ?? 0,
    visitors: data.days[date]?.uniques ?? 0,
  }));

  return {
    today: { views: today.views, visitors: today.uniques, date: todayKey },
    week: {
      views: weekViews,
      visitors: weekIds.size > 0 ? weekIds.size : weekUniqueFallback,
    },
    allTime: { views: data.totalViews, visitors: data.totalUniques },
    recentDays,
  };
}

/** Record one page view for an anonymous visitor id. */
export async function recordSiteHit(visitorId: string): Promise<void> {
  const raw = visitorId.trim().slice(0, 128);
  if (!raw) return;
  const id = hashVisitor(raw);
  const data = await load();
  const key = dayKey();
  const day = ensureDay(data, key);

  day.views += 1;
  data.totalViews += 1;

  if (!day.ids.includes(id)) {
    if (day.ids.length < MAX_DAY_IDS) day.ids.push(id);
    day.uniques += 1;
  }

  if (!data.seenIds.includes(id)) {
    data.seenIds.push(id);
    data.totalUniques += 1;
  }

  await save(data);
}

export async function getSiteStats(): Promise<SiteStatsSummary> {
  return summarize(await load());
}
