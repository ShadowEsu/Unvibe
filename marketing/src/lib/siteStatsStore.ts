/**
 * Lightweight site traffic counters (page views + unique visitors), and the daily channel counts
 * of `site_events_daily` (download clicks; visitors by first-touch utm, see siteEvents.ts).
 * Stored in Supabase when configured, else Vercel Blob, otherwise .data/site-stats.json locally.
 * Visitor ids are hashed before persistence — no emails or code. Channel counts hold no visitor id.
 * Day buckets use America/Los_Angeles calendar dates (reset at midnight PT).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SiteEventCount } from "@/lib/siteEvents";

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
  /** Channel counts without Supabase, keyed `day|event|dim1|dim2`. */
  events: Record<string, number>;
}

export interface SiteStatsSummary {
  today: { views: number; visitors: number; date: string };
  week: { views: number; visitors: number };
  allTime: { views: number; visitors: number };
  recentDays: Array<{ date: string; views: number; visitors: number }>;
  timezone: "America/Los_Angeles";
}

const BLOB_PATH = "stats/site.v1.json";
const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "site-stats.json");
const MAX_DAY_IDS = 5_000;
const MAX_SEEN_IDS = 50_000;
const KEEP_DAY_DETAIL = 120;
const STATS_TZ = "America/Los_Angeles";
let cachedSupabase: SupabaseClient | null = null;

interface TrafficDailyRow {
  visit_date: string;
  visitor_hash: string;
  views: number | string;
}

interface TrafficTotalsRow {
  total_views: number | string;
  total_visitors: number | string;
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function supabaseClient(): SupabaseClient {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase traffic storage is not configured");
  cachedSupabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cachedSupabase;
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("Durable stats storage is not configured");
  return token;
}

function pacificParts(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STATS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

/** Calendar day key in Pacific time (YYYY-MM-DD). */
export function dayKey(now = new Date()): string {
  const { year, month, day } = pacificParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function emptyStats(): StatsFile {
  return { totalViews: 0, totalUniques: 0, seenIds: [], days: {}, events: {} };
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
    events: parsed?.events && typeof parsed.events === "object" ? parsed.events : {},
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
  // Go through the Blob SDK rather than a CDN fetch. The SDK authenticates the
  // storage read correctly for serverless functions and avoids false 403s.
  const result = await get(match.url, { access: "private", token, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return emptyStats();
  return normalize(JSON.parse(await new Response(result.stream).text()) as StatsFile);
}

async function writeBlob(data: StatsFile): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(data), {
    access: "private",
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

async function readSupabase(): Promise<StatsFile> {
  const dates = lastNDates(14);
  const oldestDate = dates.at(-1) ?? dayKey();
  const [totalsResult, dailyResult] = await Promise.all([
    supabaseClient()
      .from("site_traffic_totals")
      .select("total_views,total_visitors")
      .eq("id", 1)
      .single<TrafficTotalsRow>(),
    supabaseClient()
      .from("site_traffic_daily")
      .select("visit_date,visitor_hash,views")
      .gte("visit_date", oldestDate)
      .limit(10_000)
      .returns<TrafficDailyRow[]>(),
  ]);

  if (totalsResult.error) {
    throw new Error(`Supabase traffic totals failed: ${totalsResult.error.message}`);
  }
  if (dailyResult.error) {
    throw new Error(`Supabase traffic daily stats failed: ${dailyResult.error.message}`);
  }

  const stats = emptyStats();
  stats.totalViews = Number(totalsResult.data.total_views) || 0;
  stats.totalUniques = Number(totalsResult.data.total_visitors) || 0;
  for (const row of dailyResult.data ?? []) {
    const bucket = ensureDay(stats, row.visit_date);
    bucket.views += Number(row.views) || 0;
    bucket.uniques += 1;
    bucket.ids.push(row.visitor_hash);
  }
  return stats;
}

/** Last N Pacific calendar dates, newest first. */
export function lastNDates(n: number, from = new Date()): string[] {
  const { year, month, day } = pacificParts(from);
  let y = year;
  let m = month;
  let d = day;
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth() + 1;
    d = prev.getUTCDate();
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
    timezone: STATS_TZ,
  };
}

function countEventLocally(data: StatsFile, day: string, { event, dim1, dim2 }: SiteEventCount): void {
  const key = `${day}|${event}|${dim1}|${dim2}`;
  data.events[key] = (Number(data.events[key]) || 0) + 1;
}

let lastLocalUpdate: Promise<unknown> = Promise.resolve();

/**
 * Without Supabase every write reads, changes and rewrites the whole file, so two at once (a
 * download click sends two counts) would lose one. This server process runs them one at a time.
 */
function updateLocally(change: (data: StatsFile) => void): Promise<void> {
  const run = lastLocalUpdate.then(async () => {
    const data = await load();
    change(data);
    await save(data);
  });
  lastLocalUpdate = run.catch(() => undefined);
  return run;
}

/**
 * Record one page view for an anonymous visitor id. `channel` (the visit's first-touch utm, from
 * parseVisitSource) is counted only on the visitor's first view of the day; null counts nothing.
 */
export async function recordSiteHit(visitorId: string, channel: SiteEventCount | null = null): Promise<void> {
  const raw = visitorId.trim().slice(0, 128);
  if (!raw) return;
  const id = hashVisitor(raw);
  const key = dayKey();
  if (supabaseConfigured()) {
    const { data: firstToday, error } = await supabaseClient().rpc("record_site_hit", {
      p_visitor_hash: id,
      p_visit_date: key,
    });
    if (error) throw new Error(`Supabase traffic write failed: ${error.message}`);
    if (channel && firstToday === true) await recordSiteEvent(channel, key);
    return;
  }
  await updateLocally((data) => {
    const day = ensureDay(data, key);

    day.views += 1;
    data.totalViews += 1;

    if (!day.ids.includes(id)) {
      if (day.ids.length < MAX_DAY_IDS) day.ids.push(id);
      day.uniques += 1;
      if (channel) countEventLocally(data, key, channel);
    }

    if (!data.seenIds.includes(id)) {
      data.seenIds.push(id);
      data.totalUniques += 1;
    }
  });
}

/** Add one to a daily channel count (`record_site_event`). */
export async function recordSiteEvent(count: SiteEventCount, day = dayKey()): Promise<void> {
  if (supabaseConfigured()) {
    const { error } = await supabaseClient().rpc("record_site_event", {
      p_day: day,
      p_event: count.event,
      p_dim1: count.dim1,
      p_dim2: count.dim2,
    });
    if (error) throw new Error(`Supabase site event write failed: ${error.message}`);
    return;
  }
  await updateLocally((data) => countEventLocally(data, day, count));
}

export async function getSiteStats(): Promise<SiteStatsSummary> {
  return summarize(supabaseConfigured() ? await readSupabase() : await load());
}
