import { promises as fs } from "node:fs";
import path from "node:path";
import { get, list, put } from "@vercel/blob";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { INSTALL_SOURCES, parseInstallSource, type InstallSource } from "@/lib/installSource";
import { dayKey, lastNDates } from "@/lib/siteStatsStore";
import {
  findWaitlistEntry,
  saveWaitlistEntry,
  updateWaitlistDetails,
} from "@/lib/waitlistStore";

export type BetaInstallEvent = "copied" | "fetched" | "installed" | "survey";

export interface BetaInstallCounts {
  copied: number;
  fetched: number;
  installed: number;
  survey: number;
}

/** Hidden waitlist row used when Blob is suspended and beta_install_counts is missing. */
export const BETA_INSTALL_STATS_EMAIL = "beta-install-counts@unvibe.internal";

const BLOB_PATH = "stats/beta-install.v1.json";
const localDataDir = path.join(process.cwd(), ".data");
const tmpDataDir = path.join("/tmp", "unvibe-beta-install");

let cachedSupabase: SupabaseClient | null = null;
let dataFilePromise: Promise<string> | null = null;

function emptyCounts(): BetaInstallCounts {
  return { copied: 0, fetched: 0, installed: 0, survey: 0 };
}

function normalize(parsed: Partial<BetaInstallCounts> | null | undefined): BetaInstallCounts {
  return {
    copied: Number(parsed?.copied) || 0,
    fetched: Number(parsed?.fetched) || 0,
    installed: Number(parsed?.installed) || 0,
    survey: Number(parsed?.survey) || 0,
  };
}

function usableEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed === "[SENSITIVE]" || trimmed.toLowerCase() === "sensitive") return undefined;
  return trimmed;
}

async function resolveDataFile(): Promise<string> {
  if (dataFilePromise) return dataFilePromise;
  dataFilePromise = (async () => {
    try {
      await fs.mkdir(localDataDir, { recursive: true });
      const probe = path.join(localDataDir, ".write-check");
      await fs.writeFile(probe, "ok", "utf8");
      await fs.unlink(probe);
      return path.join(localDataDir, "beta-install.json");
    } catch {
      await fs.mkdir(tmpDataDir, { recursive: true });
      return path.join(tmpDataDir, "beta-install.json");
    }
  })();
  return dataFilePromise;
}

function supabaseConfigured(): boolean {
  return Boolean(usableEnv(process.env.SUPABASE_URL) && usableEnv(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

function supabaseClient(): SupabaseClient {
  if (cachedSupabase) return cachedSupabase;
  const url = usableEnv(process.env.SUPABASE_URL);
  const key = usableEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) throw new Error("Supabase install stats storage is not configured");
  cachedSupabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cachedSupabase;
}

function blobConfigured(): boolean {
  return Boolean(usableEnv(process.env.BLOB_READ_WRITE_TOKEN));
}

function blobToken(): string {
  const token = usableEnv(process.env.BLOB_READ_WRITE_TOKEN);
  if (!token) throw new Error("Durable install stats storage is not configured");
  return token;
}

async function readLocal(): Promise<BetaInstallCounts> {
  try {
    const raw = await fs.readFile(await resolveDataFile(), "utf8");
    return normalize(JSON.parse(raw) as Partial<BetaInstallCounts>);
  } catch {
    return emptyCounts();
  }
}

async function writeLocal(data: BetaInstallCounts): Promise<void> {
  const file = await resolveDataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));
}

async function readBlob(): Promise<BetaInstallCounts> {
  const token = blobToken();
  const page = await list({ prefix: BLOB_PATH, limit: 5, token });
  const match = page.blobs.find((blob) => blob.pathname === BLOB_PATH) ?? page.blobs[0];
  if (!match) return emptyCounts();

  for (const access of ["public", "private"] as const) {
    try {
      const result = await get(match.url, { access, token, useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) continue;
      return normalize(JSON.parse(await new Response(result.stream).text()) as Partial<BetaInstallCounts>);
    } catch {
      // Try the other access mode or direct fetch below.
    }
  }

  const candidates = [match.url, (match as { downloadUrl?: string }).downloadUrl].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) continue;
      return normalize((await response.json()) as Partial<BetaInstallCounts>);
    } catch {
      // Try next candidate.
    }
  }
  return emptyCounts();
}

async function writeBlob(data: BetaInstallCounts): Promise<void> {
  const token = blobToken();
  const body = JSON.stringify(data);
  let lastError: unknown;
  for (const access of ["public", "private"] as const) {
    try {
      await put(BLOB_PATH, body, {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: "application/json",
        token,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Blob install stats write failed");
}

async function readSupabaseTable(): Promise<BetaInstallCounts> {
  const { data, error } = await supabaseClient()
    .from("beta_install_counts")
    .select("copied,fetched,installed,survey")
    .eq("id", 1)
    .maybeSingle<BetaInstallCounts>();
  if (error) throw new Error(`Supabase install stats read failed: ${error.message}`);
  return normalize(data ?? undefined);
}

async function recordSupabaseDirect(event: BetaInstallEvent): Promise<BetaInstallCounts> {
  const client = supabaseClient();
  const current = await readSupabaseTable();
  const next: BetaInstallCounts = {
    copied: current.copied + (event === "copied" ? 1 : 0),
    fetched: current.fetched + (event === "fetched" ? 1 : 0),
    installed: current.installed + (event === "installed" ? 1 : 0),
    survey: current.survey + (event === "survey" ? 1 : 0),
  };
  const { data, error } = await client
    .from("beta_install_counts")
    .upsert(
      {
        id: 1,
        copied: next.copied,
        fetched: next.fetched,
        installed: next.installed,
        survey: next.survey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("copied,fetched,installed,survey")
    .single<BetaInstallCounts>();
  if (error) throw new Error(`Supabase install stats write failed: ${error.message}`);
  return normalize(data);
}

async function recordSupabaseTable(event: BetaInstallEvent): Promise<BetaInstallCounts> {
  const { data, error } = await supabaseClient().rpc("record_beta_install_event", {
    p_event: event,
  });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    return normalize(row as Partial<BetaInstallCounts> | null | undefined);
  }
  console.error("supabase install stats rpc failed", error.message);
  return recordSupabaseDirect(event);
}

async function readWaitlistSentinel(): Promise<BetaInstallCounts> {
  const entry = await findWaitlistEntry(BETA_INSTALL_STATS_EMAIL);
  if (!entry?.message) return emptyCounts();
  try {
    return normalize(JSON.parse(entry.message) as Partial<BetaInstallCounts>);
  } catch {
    return emptyCounts();
  }
}

async function recordWaitlistSentinel(event: BetaInstallEvent): Promise<BetaInstallCounts> {
  const current = await readWaitlistSentinel();
  const next: BetaInstallCounts = {
    copied: current.copied + (event === "copied" ? 1 : 0),
    fetched: current.fetched + (event === "fetched" ? 1 : 0),
    installed: current.installed + (event === "installed" ? 1 : 0),
    survey: current.survey + (event === "survey" ? 1 : 0),
  };
  const payload = JSON.stringify(next);
  const existing = await findWaitlistEntry(BETA_INSTALL_STATS_EMAIL);
  if (!existing) {
    await saveWaitlistEntry({
      firstName: "System",
      lastName: "Counters",
      email: BETA_INSTALL_STATS_EMAIL,
      referralCode: "install00",
      message: payload,
      createdAt: new Date().toISOString(),
    });
    return next;
  }
  const updated = await updateWaitlistDetails(BETA_INSTALL_STATS_EMAIL, { message: payload });
  if (!updated) throw new Error("Install stats sentinel update failed");
  return next;
}

function maxCounts(a: BetaInstallCounts, b: BetaInstallCounts): BetaInstallCounts {
  return {
    copied: Math.max(a.copied, b.copied),
    fetched: Math.max(a.fetched, b.fetched),
    installed: Math.max(a.installed, b.installed),
    survey: Math.max(a.survey, b.survey),
  };
}

export function parseBetaInstallEvent(value: unknown): BetaInstallEvent | null {
  if (value === "copied" || value === "fetched" || value === "installed" || value === "survey") return value;
  return null;
}

/**
 * A body POSTed to /api/install/event: `{ event }`, plus `source` (a label from INSTALL_SOURCES)
 * only with `copied`. `fetched` is counted by the install script route, never here. Null when
 * anything else is in it, so a bad label is refused, never stored.
 */
export function parseSiteInstallEvent(body: unknown): { event: Exclude<BetaInstallEvent, "fetched">; source: InstallSource | null } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { event: rawEvent, source: rawSource, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return null;
  const event = parseBetaInstallEvent(rawEvent);
  if (!event || event === "fetched") return null;
  if (rawSource === undefined) return { event, source: null };
  const source = parseInstallSource(rawSource);
  return source && event === "copied" ? { event, source } : null;
}

export function isBetaInstallStatsEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === BETA_INSTALL_STATS_EMAIL;
}

export async function recordBetaInstallEvent(event: BetaInstallEvent): Promise<BetaInstallCounts> {
  if (supabaseConfigured()) {
    try {
      return await recordSupabaseTable(event);
    } catch (error) {
      console.error("supabase install stats write failed", error);
    }
  }
  // Production today: Blob store is suspended, dedicated counter table missing.
  // Persist through the working waitlist_entries store as a hidden sentinel row.
  if (supabaseConfigured()) {
    try {
      return await recordWaitlistSentinel(event);
    } catch (error) {
      console.error("waitlist sentinel install stats write failed", error);
    }
  }
  if (blobConfigured()) {
    try {
      const data = await readBlob();
      data[event] += 1;
      await writeBlob(data);
      return data;
    } catch (error) {
      console.error("blob install stats write failed", error);
    }
  }
  try {
    const data = await readLocal();
    data[event] += 1;
    await writeLocal(data);
    return data;
  } catch (error) {
    console.error("local install stats write failed", error);
    const data = emptyCounts();
    data[event] = 1;
    return data;
  }
}

/** The counts plus where install command copies came from (founder stats only, never the event reply). */
export interface BetaInstallStats extends BetaInstallCounts {
  copiedBySource: CopySourceBreakdown;
}

export async function getBetaInstallCounts(now = new Date()): Promise<BetaInstallStats> {
  let best = emptyCounts();

  if (supabaseConfigured()) {
    try {
      best = maxCounts(best, await readSupabaseTable());
    } catch (error) {
      console.error("supabase install stats read failed", error);
    }
    try {
      best = maxCounts(best, await readWaitlistSentinel());
    } catch (error) {
      console.error("waitlist sentinel install stats read failed", error);
    }
  }
  if (blobConfigured()) {
    try {
      best = maxCounts(best, await readBlob());
    } catch (error) {
      console.error("blob install stats read failed", error);
    }
  }
  try {
    best = maxCounts(best, await readLocal());
  } catch {
    // Ignore local read failures.
  }
  return { ...best, copiedBySource: summarizeCopySources(await readCopySourceRows(now), now) };
}

/**
 * Install command copies per first-touch source label (installSource.ts), per Pacific day: one row
 * per day and label holding only a count, no ID, IP address, page or time (migration 0012). Kept
 * 12 months; the write deletes older days.
 */
export interface CopySourceRow {
  day: string;
  source: InstallSource;
  copied: number;
}

export interface CopySourceBreakdown {
  /** Last 14 Pacific days, oldest first; each lists only labels with a copy that day, largest first. */
  daily: Array<{ date: string; sources: Array<{ source: InstallSource; copied: number }> }>;
  /** Those 14 days added up, largest first. */
  totals: Array<{ source: InstallSource; copied: number }>;
  timezone: "America/Los_Angeles";
}

const COPY_SOURCE_DAYS = 14;

function bySize(counts: Map<InstallSource, number>): Array<{ source: InstallSource; copied: number }> {
  return Array.from(counts)
    .map(([source, copied]) => ({ source, copied }))
    .sort((a, b) => b.copied - a.copied || INSTALL_SOURCES.indexOf(a.source) - INSTALL_SOURCES.indexOf(b.source));
}

export function summarizeCopySources(rows: readonly CopySourceRow[], now = new Date()): CopySourceBreakdown {
  const dates = lastNDates(COPY_SOURCE_DAYS, now).reverse();
  const perDay = new Map(dates.map((date) => [date, new Map<InstallSource, number>()]));
  const totals = new Map<InstallSource, number>();
  for (const row of rows) {
    const day = perDay.get(row.day);
    const source = parseInstallSource(row.source);
    const copied = Number(row.copied) || 0;
    if (!day || !source || copied <= 0) continue;
    day.set(source, (day.get(source) ?? 0) + copied);
    totals.set(source, (totals.get(source) ?? 0) + copied);
  }
  return {
    daily: dates.map((date) => ({ date, sources: bySize(perDay.get(date) ?? new Map()) })),
    totals: bySize(totals),
    timezone: "America/Los_Angeles",
  };
}

async function copySourcesFile(): Promise<string> {
  return path.join(path.dirname(await resolveDataFile()), "beta-install-sources.json");
}

async function readLocalCopySources(): Promise<CopySourceRow[]> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(await copySourcesFile(), "utf8"));
    return Array.isArray(parsed) ? (parsed as CopySourceRow[]) : [];
  } catch {
    return [];
  }
}

/**
 * Adds one copy to today's count for `source`. Supabase when configured (the
 * `record_beta_install_copy_source` function); a local file only where Supabase isn't configured
 * (development and tests). Best effort: a failure is logged without the label and never fails the
 * copy count itself.
 */
export async function recordBetaInstallCopySource(source: InstallSource, now = new Date()): Promise<void> {
  const day = dayKey(now);
  if (supabaseConfigured()) {
    const { error } = await supabaseClient().rpc("record_beta_install_copy_source", { p_day: day, p_source: source });
    if (error) console.error("install copy source count failed", error.code);
    return;
  }
  try {
    const rows = await readLocalCopySources();
    const row = rows.find((item) => item.day === day && item.source === source);
    if (row) row.copied += 1;
    else rows.push({ day, source, copied: 1 });
    const file = await copySourcesFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(rows));
  } catch (error) {
    console.error("local install copy source count failed", error instanceof Error ? error.name : "error");
  }
}

async function readCopySourceRows(now: Date): Promise<CopySourceRow[]> {
  if (!supabaseConfigured()) return readLocalCopySources();
  const since = lastNDates(COPY_SOURCE_DAYS, now).at(-1) ?? dayKey(now);
  const { data, error } = await supabaseClient()
    .from("beta_install_copy_sources")
    .select("day,source,copied")
    .gte("day", since);
  if (error) {
    console.error("install copy source read failed", error.code);
    return [];
  }
  return (data ?? []) as CopySourceRow[];
}
