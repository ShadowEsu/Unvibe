import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface WaitlistNotificationRecord {
  status: "sent" | "failed";
  provider: "resend" | "formsubmit" | "none";
  at: string;
  messageId?: string;
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
  betaInviteAt?: string;
}

export interface WaitlistAdminEntry extends WaitlistEntry {
  id: string;
}

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
  notification_status: "sent" | "failed" | null;
  notification_provider: "resend" | "formsubmit" | "none" | null;
  notification_at: string | null;
  notification_message_id: string | null;
  invited_at: string | null;
}

function rowToEntry(row: WaitlistRow): WaitlistAdminEntry {
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
    notification: row.notification_status
      ? {
          status: row.notification_status,
          provider: row.notification_provider ?? "none",
          at: row.notification_at ?? row.created_at,
          messageId: row.notification_message_id ?? undefined,
        }
      : undefined,
    betaInviteAt: row.invited_at ?? undefined,
  };
}

const localDataDir = path.join(process.cwd(), ".data");
const tmpDataDir = path.join("/tmp", "unvibe-waitlist");

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

function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

let cachedClient: SupabaseClient | null = null;

/** Server-only client using the service role key. RLS blocks anon access entirely. */
function supabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Durable waitlist storage is not configured");
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

const UNIQUE_VIOLATION = "23505";

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
): Promise<{ duplicate: boolean; storage: "supabase" | "local" }> {
  if (supabaseConfigured()) {
    const { error } = await supabaseAdmin().from("waitlist_entries").insert({
      first_name: entry.firstName,
      last_name: entry.lastName,
      email: entry.email,
      referred_by: entry.referredBy ?? null,
      promo_code: entry.promoCode ?? null,
      referral_code: entry.referralCode,
      utm_source: entry.utmSource ?? null,
      utm_medium: entry.utmMedium ?? null,
      utm_campaign: entry.utmCampaign ?? null,
      created_at: entry.createdAt,
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { duplicate: true, storage: "supabase" };
      throw new Error(`Supabase waitlist insert failed: ${error.message}`);
    }
    return { duplicate: false, storage: "supabase" };
  }

  const entries = await readLocal();
  if (entries.some((item) => item.email === entry.email)) {
    return { duplicate: true, storage: "local" };
  }
  await writeLocal([...entries, entry]);
  return { duplicate: false, storage: "local" };
}

export async function updateWaitlistDetails(
  email: string,
  details: { tool?: string; experience?: string; message?: string },
): Promise<boolean> {
  if (supabaseConfigured()) {
    const { data, error } = await supabaseAdmin()
      .from("waitlist_entries")
      .update({
        tool: details.tool ?? null,
        experience: details.experience ?? null,
        message: details.message || null,
      })
      .eq("email", email)
      .select("id");
    if (error) throw new Error(`Supabase waitlist update failed: ${error.message}`);
    return (data?.length ?? 0) > 0;
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
  if (supabaseConfigured()) {
    const { error } = await supabaseAdmin()
      .from("waitlist_entries")
      .update({
        notification_status: notification.status,
        notification_provider: notification.provider,
        notification_at: notification.at,
        notification_message_id: notification.messageId ?? null,
      })
      .eq("email", email);
    if (error) throw new Error(`Supabase waitlist notification update failed: ${error.message}`);
    return;
  }

  const entries = await readLocal();
  const entry = entries.find((item) => item.email === email);
  if (!entry) return;
  entry.notification = notification;
  await writeLocal(entries);
}

export async function listWaitlistEntries(limit = 500): Promise<WaitlistAdminEntry[]> {
  if (supabaseConfigured()) {
    const { data, error } = await supabaseAdmin()
      .from("waitlist_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase waitlist list failed: ${error.message}`);
    return ((data ?? []) as WaitlistRow[]).map(rowToEntry);
  }
  return (await readLocal())
    .map((entry) => ({ ...entry, id: entry.referralCode }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
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
  if (supabaseConfigured()) {
    const { data, error } = await supabaseAdmin()
      .from("waitlist_entries")
      .update({ invited_at: betaInviteAt })
      .eq("email", email)
      .select("id");
    if (error) throw new Error(`Supabase mark beta invite failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error("Waitlist entry was not found while recording beta invite");
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
    const { data, error } = await supabaseAdmin()
      .from("waitlist_entries")
      .delete()
      .eq("email", normalized)
      .select("id");
    if (error) throw new Error(`Supabase waitlist delete failed: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }

  const entries = await readLocal();
  const next = entries.filter((item) => item.email.trim().toLowerCase() !== normalized);
  if (next.length === entries.length) return false;
  await writeLocal(next);
  return true;
}
