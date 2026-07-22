import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Shared waitlist persistence for both the /api/waitlist route and the send-beta-invites
 * script, so there is exactly one definition of the entry shape and one local-file fallback.
 */

export interface WaitlistEntry {
  email: string;
  tool: string;
  experience: string;
  message?: string;
  referredBy?: string;
  referralCode: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  promoCode?: string;
  proGranted: boolean;
  proMonths?: number;
  proExpiresAt?: string;
  invitedAt?: string;
  createdAt: string;
}

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "waitlist.json");

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function readLocalEntries(): Promise<WaitlistEntry[]> {
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8")) as WaitlistEntry[];
  } catch {
    return [];
  }
}

export async function writeLocalEntries(entries: WaitlistEntry[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(entries, null, 2), "utf8");
}

async function supabaseClient() {
  const url = process.env.SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface WaitlistRow {
  email: string;
  tool: string;
  experience: string;
  message: string | null;
  referred_by: string | null;
  referral_code: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  promo_code: string | null;
  pro_granted: boolean;
  pro_months: number | null;
  pro_expires_at: string | null;
  invited_at: string | null;
  created_at: string;
}

function rowToEntry(row: WaitlistRow): WaitlistEntry {
  return {
    email: row.email,
    tool: row.tool,
    experience: row.experience,
    message: row.message ?? undefined,
    referredBy: row.referred_by ?? undefined,
    referralCode: row.referral_code,
    utmSource: row.utm_source ?? undefined,
    utmMedium: row.utm_medium ?? undefined,
    utmCampaign: row.utm_campaign ?? undefined,
    promoCode: row.promo_code ?? undefined,
    proGranted: row.pro_granted,
    proMonths: row.pro_months ?? undefined,
    proExpiresAt: row.pro_expires_at ?? undefined,
    invitedAt: row.invited_at ?? undefined,
    createdAt: row.created_at,
  };
}

/** All waitlist entries that have not yet received the beta invite email. */
export async function listUninvited(): Promise<WaitlistEntry[]> {
  if (supabaseConfigured()) {
    const db = await supabaseClient();
    const { data, error } = await db
      .from("waitlist_entries")
      .select("*")
      .is("invited_at", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Supabase read failed: ${error.message}`);
    return ((data ?? []) as WaitlistRow[]).map(rowToEntry);
  }
  const entries = await readLocalEntries();
  return entries.filter((e) => !e.invitedAt);
}

/** Marks one waitlist entry as invited so a re-run of the send script skips it. */
export async function markInvited(email: string, invitedAt: string): Promise<void> {
  if (supabaseConfigured()) {
    const db = await supabaseClient();
    const { error } = await db
      .from("waitlist_entries")
      .update({ invited_at: invitedAt })
      .eq("email", email);
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
    return;
  }
  const entries = await readLocalEntries();
  const idx = entries.findIndex((e) => e.email === email);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], invitedAt };
    await writeLocalEntries(entries);
  }
}
