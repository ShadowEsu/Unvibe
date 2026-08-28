import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { decryptWaitlistJson, encryptWaitlistJson } from "@/lib/waitlistCrypto";
import { dayKey, lastNDates } from "@/lib/siteStatsStore";

export interface WaitlistNotificationRecord {
  status: "sent" | "failed";
  provider: "resend" | "formsubmit" | "none";
  at: string;
  messageId?: string;
}

export interface WaitlistBetaEmailRecord {
  status: "sent" | "failed";
  at: string;
  messageId?: string;
  error?: string;
}

export interface WaitlistEntry {
  firstName: string;
  lastName: string;
  email: string;
  tool?: string;
  experience?: string;
  message?: string;
  referredBy?: string;
  promoCode?: string;
  referralCode: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdAt: string;
  notification?: WaitlistNotificationRecord;
  betaEmail?: WaitlistBetaEmailRecord;
  betaInviteAt?: string;
}

export interface WaitlistAdminEntry extends WaitlistEntry {
  id: string;
}

/**
 * A privacy-safe summary for funnel monitoring. It intentionally contains no
 * names, emails, referral codes, free-text answers, or individual timestamps.
 */
export interface WaitlistFunnelSummary {
  total: number;
  attributed: number;
  referred: number;
  sourceCounts: Array<{ source: string; signups: number }>;
  campaignCounts: Array<{ source: string; medium: string; campaign: string; signups: number }>;
  dailySignups: Array<{ date: string; signups: number }>;
  timezone: "America/Los_Angeles";
}

const ENTRY_PREFIX = "waitlist/item/";
const LEGACY_BLOB_PATH = "waitlist/entries.v2.enc";
const LEGACY_BLOB_PATH_V1 = "waitlist/entries.v1.enc";
const localDataDir = path.join(process.cwd(), ".data");
const tmpDataDir = path.join("/tmp", "unvibe-waitlist");

interface WaitlistRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  tool: string | null;
  experience: string | null;
  message: string | null;
  referred_by: string | null;
  promo_code: string | null;
  referral_code: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  notification_status: WaitlistNotificationRecord["status"] | null;
  notification_provider: WaitlistNotificationRecord["provider"] | null;
  notification_at: string | null;
  notification_message_id: string | null;
  beta_email_status: WaitlistBetaEmailRecord["status"] | null;
  beta_email_at: string | null;
  beta_email_message_id: string | null;
  beta_email_error: string | null;
  invited_at: string | null;
}

let cachedSupabase: SupabaseClient | null = null;

function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function supabaseClient(): SupabaseClient {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase waitlist storage is not configured");
  cachedSupabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedSupabase;
}

function entryFromRow(row: WaitlistRow): WaitlistAdminEntry {
  return {
    id: row.id,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email,
    tool: row.tool ?? undefined,
    experience: row.experience ?? undefined,
    message: row.message ?? undefined,
    referredBy: row.referred_by ?? undefined,
    promoCode: row.promo_code ?? undefined,
    referralCode: row.referral_code,
    utmSource: row.utm_source ?? undefined,
    utmMedium: row.utm_medium ?? undefined,
    utmCampaign: row.utm_campaign ?? undefined,
    createdAt: row.created_at,
    notification: row.notification_status && row.notification_provider && row.notification_at
      ? {
        status: row.notification_status,
        provider: row.notification_provider,
        at: row.notification_at,
        messageId: row.notification_message_id ?? undefined,
      }
      : undefined,
    betaEmail: row.beta_email_status && row.beta_email_at
      ? {
        status: row.beta_email_status,
        at: row.beta_email_at,
        messageId: row.beta_email_message_id ?? undefined,
        error: row.beta_email_error ?? undefined,
      }
      : undefined,
    betaInviteAt: row.invited_at ?? undefined,
  };
}

async function findSupabaseEntry(email: string): Promise<WaitlistAdminEntry | null> {
  const { data, error } = await supabaseClient()
    .from("waitlist_entries")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle<WaitlistRow>();
  if (error) throw new Error(`Supabase waitlist read failed: ${error.message}`);
  return data ? entryFromRow(data) : null;
}

async function resolveDataFile(): Promise<string> {
  try {
    await fs.mkdir(localDataDir, { recursive: true });
    const probe = path.join(localDataDir, ".write-check");
    await fs.writeFile(probe, "ok", "utf8");
    await fs.unlink(probe);
    return path.join(localDataDir, "waitlist.json");
  } catch {
    await fs.mkdir(tmpDataDir, { recursive: true });
    return path.join(tmpDataDir, "waitlist.json");
  }
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function encryptionConfigured(): boolean {
  return Boolean(process.env.WAITLIST_ADMIN_TOKEN?.trim());
}

/** Encrypted Blob is used only when both storage and encryption secrets exist. */
function durableBlobReady(): boolean {
  return blobConfigured() && encryptionConfigured();
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("Durable waitlist storage is not configured");
  return token;
}

function storageSecret(): string {
  const secret = process.env.WAITLIST_ADMIN_TOKEN?.trim();
  if (!secret) throw new Error("Waitlist encryption is not configured");
  return secret;
}

function entryPath(email: string): string {
  const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
  return `${ENTRY_PREFIX}${digest}.enc`;
}

function decryptEntry(body: string): WaitlistEntry {
  const parsed: unknown = decryptWaitlistJson(body, storageSecret());
  if (!parsed || typeof parsed !== "object") throw new Error("Waitlist storage contains invalid data");
  return parsed as WaitlistEntry;
}

async function putEntry(entry: WaitlistEntry): Promise<void> {
  await put(entryPath(entry.email), encryptWaitlistJson(entry, storageSecret()), {
    // The configured Vercel store is private. The server-side token still
    // permits reads/writes; this prevents encrypted waitlist records being
    // reachable by a public CDN URL.
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/octet-stream",
    token: blobToken(),
  });
}

async function readEntryBlob(url: string): Promise<WaitlistEntry | null> {
  // Read through the Blob SDK. Direct fetches against a Blob CDN URL can be
  // rejected even with a server token, which made the founder waitlist view
  // fail despite a healthy configured store.
  const result = await get(url, { access: "private", token: blobToken(), useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const body = await new Response(result.stream).text();
  if (!body.trim()) return null;
  return decryptEntry(body);
}

async function listEntryBlobs(): Promise<WaitlistEntry[]> {
  const token = blobToken();
  const entries: WaitlistEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: ENTRY_PREFIX, cursor, limit: 1000, token });
    for (const blob of page.blobs) {
      if (!blob.pathname.endsWith(".enc")) continue;
      const entry = await readEntryBlob(blob.url);
      if (entry) entries.push(entry);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return entries;
}

async function migrateLegacyIfNeeded(): Promise<void> {
  const token = blobToken();
  const existing = await list({ prefix: ENTRY_PREFIX, limit: 1, token });
  if (existing.blobs.length > 0) return;

  for (const legacyPath of [LEGACY_BLOB_PATH, LEGACY_BLOB_PATH_V1]) {
    const listed = await list({ prefix: legacyPath, limit: 5, token });
    const found = listed.blobs.find((blob) => blob.pathname === legacyPath);
    if (!found) continue;
    const downloadUrl = new URL(found.url);
    downloadUrl.searchParams.set("download", "1");
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
      cache: "no-store",
    });
    if (!response.ok) continue;
    const body = await response.text();
    try {
      const parsed: unknown = decryptWaitlistJson(body, storageSecret());
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed as WaitlistEntry[]) {
        if (item?.email) await putEntry(item);
      }
      return;
    } catch {
      // Ignore undecryptable legacy blobs and continue.
    }
  }
}

async function readLocal(): Promise<WaitlistEntry[]> {
  try {
    const dataFile = await resolveDataFile();
    const parsed: unknown = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return Array.isArray(parsed) ? (parsed as WaitlistEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeLocal(entries: WaitlistEntry[]): Promise<void> {
  const dataFile = await resolveDataFile();
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(entries, null, 2), "utf8");
}

export async function saveWaitlistEntry(
  entry: WaitlistEntry,
): Promise<{ duplicate: boolean; storage: "supabase" | "blob" | "local" }> {
  if (supabaseConfigured()) {
    const { error } = await supabaseClient().from("waitlist_entries").insert({
      first_name: entry.firstName,
      last_name: entry.lastName,
      email: entry.email.trim().toLowerCase(),
      tool: entry.tool ?? null,
      experience: entry.experience ?? null,
      message: entry.message ?? null,
      referred_by: entry.referredBy ?? null,
      promo_code: entry.promoCode ?? null,
      referral_code: entry.referralCode,
      utm_source: entry.utmSource ?? null,
      utm_medium: entry.utmMedium ?? null,
      utm_campaign: entry.utmCampaign ?? null,
      created_at: entry.createdAt,
    });
    if (!error) return { duplicate: false, storage: "supabase" };
    if (error.code === "23505") return { duplicate: true, storage: "supabase" };
    throw new Error(`Supabase waitlist insert failed: ${error.message}`);
  }
  if (durableBlobReady()) {
    await migrateLegacyIfNeeded();
    const pathName = entryPath(entry.email);
    const listed = await list({ prefix: pathName, limit: 5, token: blobToken() });
    const exists = listed.blobs.some((blob) => blob.pathname === pathName);
    if (exists) return { duplicate: true, storage: "blob" };
    await putEntry(entry);
    return { duplicate: false, storage: "blob" };
  }

  const entries = await readLocal();
  if (entries.some((item) => item.email === entry.email)) {
    return { duplicate: true, storage: "local" };
  }
  await writeLocal([...entries, entry]);
  return { duplicate: false, storage: "local" };
}

/** Read one exact signup so retries can repair a failed user email without spamming successful deliveries. */
export async function findWaitlistEntry(email: string): Promise<WaitlistEntry | null> {
  const normalized = email.trim().toLowerCase();
  if (supabaseConfigured()) return findSupabaseEntry(normalized);
  if (durableBlobReady()) {
    await migrateLegacyIfNeeded();
    const pathName = entryPath(normalized);
    const listed = await list({ prefix: pathName, limit: 5, token: blobToken() });
    const found = listed.blobs.find((blob) => blob.pathname === pathName);
    return found ? readEntryBlob(found.url) : null;
  }
  return (await readLocal()).find((entry) => entry.email.trim().toLowerCase() === normalized) ?? null;
}

/** Persist whether Resend accepted the beta download email for this exact person. */
export async function recordWaitlistBetaEmail(
  email: string,
  betaEmail: WaitlistBetaEmailRecord,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (supabaseConfigured()) {
    const { error } = await supabaseClient().from("waitlist_entries").update({
      beta_email_status: betaEmail.status,
      beta_email_at: betaEmail.at,
      beta_email_message_id: betaEmail.messageId ?? null,
      beta_email_error: betaEmail.error ?? null,
    }).eq("email", normalized);
    if (error) throw new Error(`Supabase beta email status update failed: ${error.message}`);
    return;
  }
  if (durableBlobReady()) {
    await migrateLegacyIfNeeded();
    const current = await findWaitlistEntry(normalized);
    if (!current) throw new Error("Waitlist entry was not found while recording beta email status");
    current.betaEmail = betaEmail;
    await putEntry(current);
    return;
  }
  const entries = await readLocal();
  const entry = entries.find((item) => item.email.trim().toLowerCase() === normalized);
  if (!entry) throw new Error("Waitlist entry was not found while recording beta email status");
  entry.betaEmail = betaEmail;
  await writeLocal(entries);
}

export async function updateWaitlistDetails(
  email: string,
  details: { tool?: string; experience?: string; message?: string },
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (supabaseConfigured()) {
    const { data, error } = await supabaseClient().from("waitlist_entries").update({
      tool: details.tool ?? null,
      experience: details.experience ?? null,
      message: details.message || null,
    }).eq("email", normalized).select("id");
    if (error) throw new Error(`Supabase waitlist details update failed: ${error.message}`);
    return Boolean(data?.length);
  }
  if (durableBlobReady()) {
    await migrateLegacyIfNeeded();
    const pathName = entryPath(email);
    const listed = await list({ prefix: pathName, limit: 5, token: blobToken() });
    const found = listed.blobs.find((blob) => blob.pathname === pathName);
    if (!found) return false;
    const current = await readEntryBlob(found.url);
    if (!current) return false;
    current.tool = details.tool;
    current.experience = details.experience;
    current.message = details.message || undefined;
    await putEntry(current);
    return true;
  }

  const entries = await readLocal();
  const entry = entries.find((item) => item.email === email);
  if (!entry) return false;
  entry.tool = details.tool;
  entry.experience = details.experience;
  entry.message = details.message || undefined;
  await writeLocal(entries);
  return true;
}

export async function recordWaitlistNotification(
  email: string,
  notification: WaitlistNotificationRecord,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (supabaseConfigured()) {
    const { error } = await supabaseClient().from("waitlist_entries").update({
      notification_status: notification.status,
      notification_provider: notification.provider,
      notification_at: notification.at,
      notification_message_id: notification.messageId ?? null,
    }).eq("email", normalized);
    if (error) throw new Error(`Supabase notification status update failed: ${error.message}`);
    return;
  }
  if (durableBlobReady()) {
    await migrateLegacyIfNeeded();
    const pathName = entryPath(email);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const listed = await list({ prefix: pathName, limit: 5, token: blobToken() });
      const found = listed.blobs.find((blob) => blob.pathname === pathName);
      if (!found) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      const current = await readEntryBlob(found.url);
      if (!current) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      current.notification = notification;
      await putEntry(current);
      return;
    }
    throw new Error("Waitlist entry was not visible while recording notification status");
  }

  const entries = await readLocal();
  const entry = entries.find((item) => item.email === email);
  if (!entry) return;
  entry.notification = notification;
  await writeLocal(entries);
}

export async function listWaitlistEntries(limit = 500): Promise<WaitlistAdminEntry[]> {
  if (supabaseConfigured()) {
    const { data, error } = await supabaseClient()
      .from("waitlist_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<WaitlistRow[]>();
    if (error) throw new Error(`Supabase waitlist list failed: ${error.message}`);
    return (data ?? []).map(entryFromRow);
  }
  if (durableBlobReady()) {
    await migrateLegacyIfNeeded();
    const entries = await listEntryBlobs();
    return entries
      .map((entry) => ({ ...entry, id: entry.referralCode }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  return (await readLocal())
    .map((entry) => ({ ...entry, id: entry.referralCode }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

const MAX_SOURCE_BUCKETS = 12;

function sourceBucket(utmSource: string | undefined): string {
  const normalized = utmSource?.trim().toLowerCase() ?? "";
  if (!normalized) return "direct";
  // UTM values are supplied from a public URL. Never return malformed values
  // verbatim from this aggregate endpoint, since they could contain PII.
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : "other-tagged";
}

function campaignBucket(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "(not set)";
  // Campaign and medium are also public URL input, so apply the same
  // allowlist before returning them from the aggregate-only endpoint.
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : "other-tagged";
}

/** Build aggregate waitlist attribution without returning an entry or identifier. */
export function summarizeWaitlistFunnel(
  entries: readonly WaitlistEntry[],
  now = new Date(),
): WaitlistFunnelSummary {
  const sources = new Map<string, number>();
  const campaigns = new Map<string, { source: string; medium: string; campaign: string; signups: number }>();
  const days = new Map<string, number>();
  let attributed = 0;
  let referred = 0;

  for (const entry of entries) {
    const source = sourceBucket(entry.utmSource);
    const medium = campaignBucket(entry.utmMedium);
    const campaign = campaignBucket(entry.utmCampaign);
    sources.set(source, (sources.get(source) ?? 0) + 1);
    const campaignKey = `${source}\u0000${medium}\u0000${campaign}`;
    const existingCampaign = campaigns.get(campaignKey);
    if (existingCampaign) existingCampaign.signups += 1;
    else campaigns.set(campaignKey, { source, medium, campaign, signups: 1 });
    if (source !== "direct") attributed += 1;
    if (entry.referredBy?.trim()) referred += 1;

    const createdAt = new Date(entry.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      const date = dayKey(createdAt);
      days.set(date, (days.get(date) ?? 0) + 1);
    }
  }

  const orderedSources = Array.from(sources.entries())
    .sort(([leftSource, leftCount], [rightSource, rightCount]) => rightCount - leftCount || leftSource.localeCompare(rightSource));
  const visibleSources = orderedSources.slice(0, MAX_SOURCE_BUCKETS);
  const overflow = orderedSources.slice(MAX_SOURCE_BUCKETS).reduce((sum, [, count]) => sum + count, 0);
  if (overflow) visibleSources.push(["other", overflow]);
  const orderedCampaigns = Array.from(campaigns.values())
    .sort((left, right) => right.signups - left.signups
      || left.source.localeCompare(right.source)
      || left.medium.localeCompare(right.medium)
      || left.campaign.localeCompare(right.campaign));
  const campaignCounts = orderedCampaigns.slice(0, MAX_SOURCE_BUCKETS);
  const campaignOverflow = orderedCampaigns.slice(MAX_SOURCE_BUCKETS).reduce((sum, item) => sum + item.signups, 0);
  if (campaignOverflow) {
    campaignCounts.push({ source: "other", medium: "(other)", campaign: "(other)", signups: campaignOverflow });
  }

  return {
    total: entries.length,
    attributed,
    referred,
    sourceCounts: visibleSources.map(([source, signups]) => ({ source, signups })),
    campaignCounts,
    dailySignups: lastNDates(14, now).map((date) => ({ date, signups: days.get(date) ?? 0 })),
    timezone: "America/Los_Angeles",
  };
}

/** Load the aggregate used by the authorized funnel-monitoring endpoint. */
export async function getWaitlistFunnelSummary(): Promise<WaitlistFunnelSummary> {
  return summarizeWaitlistFunnel(await listWaitlistEntries(10_000));
}

/** Resolves a referring waitlister without ever returning their personal details. */
export async function referralCodeForEmail(email: string): Promise<string | undefined> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  const entries = await listWaitlistEntries(10_000);
  return entries.find((entry) => entry.email.trim().toLowerCase() === normalized)?.referralCode;
}

/** Public referral progress deliberately exposes only aggregate counts for a code, never identities. */
export async function referralProgress(code: string): Promise<{ found: boolean; joinedReferrals: number }> {
  const normalized = code.trim().toLowerCase();
  if (!/^[a-f0-9]{8}$/.test(normalized)) return { found: false, joinedReferrals: 0 };
  const entries = await listWaitlistEntries(10_000);
  const found = entries.some((entry) => entry.referralCode.toLowerCase() === normalized);
  if (!found) return { found: false, joinedReferrals: 0 };
  return {
    found: true,
    joinedReferrals: entries.filter((entry) => entry.referredBy?.trim().toLowerCase() === normalized).length,
  };
}

/** Entries are marked only after Resend accepts the beta invitation, making batches safe to retry. */
export async function markBetaInviteSent(email: string, betaInviteAt: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (supabaseConfigured()) {
    const { error } = await supabaseClient()
      .from("waitlist_entries")
      .update({ invited_at: betaInviteAt })
      .eq("email", normalized);
    if (error) throw new Error(`Supabase beta invite update failed: ${error.message}`);
    return;
  }
  if (durableBlobReady()) {
    const pathName = entryPath(email);
    const listed = await list({ prefix: pathName, limit: 5, token: blobToken() });
    const found = listed.blobs.find((blob) => blob.pathname === pathName);
    if (!found) throw new Error("Waitlist entry was not found while recording beta invite");
    const current = await readEntryBlob(found.url);
    if (!current) throw new Error("Waitlist entry could not be read while recording beta invite");
    current.betaInviteAt = betaInviteAt;
    await putEntry(current);
    return;
  }
  const entries = await readLocal();
  const entry = entries.find((item) => item.email.trim().toLowerCase() === email.trim().toLowerCase());
  if (!entry) throw new Error("Waitlist entry was not found while recording beta invite");
  entry.betaInviteAt = betaInviteAt;
  await writeLocal(entries);
}

export async function listUninvitedWaitlistEntries(): Promise<WaitlistAdminEntry[]> {
  return (await listWaitlistEntries(10_000)).filter((entry) => !entry.betaInviteAt);
}

export async function deleteWaitlistEntry(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  if (supabaseConfigured()) {
    const { data, error } = await supabaseClient()
      .from("waitlist_entries")
      .delete()
      .eq("email", normalized)
      .select("id");
    if (error) throw new Error(`Supabase waitlist delete failed: ${error.message}`);
    return Boolean(data?.length);
  }

  if (durableBlobReady()) {
    await migrateLegacyIfNeeded();
    const pathName = entryPath(normalized);
    const listed = await list({ prefix: pathName, limit: 5, token: blobToken() });
    const found = listed.blobs.find((blob) => blob.pathname === pathName);
    if (!found) return false;
    await del(found.url, { token: blobToken() });
    return true;
  }

  const entries = await readLocal();
  const next = entries.filter((item) => item.email.trim().toLowerCase() !== normalized);
  if (next.length === entries.length) return false;
  await writeLocal(next);
  return true;
}
