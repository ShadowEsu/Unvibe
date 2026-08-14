import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptWaitlistJson, encryptWaitlistJson } from "@/lib/waitlistCrypto";

export interface BetaDownloadEntry {
  firstName: string;
  email: string;
  platform: "mac";
  release: string;
  referralCode: string;
  createdAt: string;
  emailSentAt?: string;
  emailMessageId?: string;
}

const PREFIX = "beta-downloads/item/";
const localDir = path.join(process.cwd(), ".data");
let cachedSupabase: SupabaseClient | null = null;

interface BetaDownloadRow {
  first_name: string;
  email: string;
  platform: "mac";
  release: string;
  referral_code: string;
  created_at: string;
  email_sent_at: string | null;
  email_message_id: string | null;
}

function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function supabaseClient(): SupabaseClient {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase beta-download storage is not configured");
  cachedSupabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedSupabase;
}

function fromRow(row: BetaDownloadRow): BetaDownloadEntry {
  return {
    firstName: row.first_name,
    email: row.email,
    platform: row.platform,
    release: row.release,
    referralCode: row.referral_code,
    createdAt: row.created_at,
    emailSentAt: row.email_sent_at ?? undefined,
    emailMessageId: row.email_message_id ?? undefined,
  };
}

function secret(): string {
  return process.env.WAITLIST_ADMIN_TOKEN?.trim() || "local-beta-downloads";
}

function token(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

function keyFor(email: string, release: string): string {
  return createHash("sha256").update(`${release}:${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

function pathname(email: string, release: string): string {
  return `${PREFIX}${keyFor(email, release)}.enc`;
}

function localFile(): string {
  return path.join(localDir, "beta-downloads.json");
}

async function readLocal(): Promise<BetaDownloadEntry[]> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(localFile(), "utf8"));
    return Array.isArray(parsed) ? parsed as BetaDownloadEntry[] : [];
  } catch {
    return [];
  }
}

async function writeLocal(entries: BetaDownloadEntry[]): Promise<void> {
  await fs.mkdir(localDir, { recursive: true });
  await fs.writeFile(localFile(), JSON.stringify(entries, null, 2), "utf8");
}

export async function findBetaDownload(email: string, release: string): Promise<BetaDownloadEntry | null> {
  if (supabaseConfigured()) {
    const { data, error } = await supabaseClient()
      .from("beta_downloads")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .eq("release", release)
      .maybeSingle<BetaDownloadRow>();
    if (error) throw new Error(`Supabase beta-download read failed: ${error.message}`);
    return data ? fromRow(data) : null;
  }
  const blobToken = token();
  if (!blobToken || !process.env.WAITLIST_ADMIN_TOKEN?.trim()) {
    return (await readLocal()).find((entry) => entry.email === email && entry.release === release) ?? null;
  }
  const target = pathname(email, release);
  const page = await list({ prefix: target, limit: 1, token: blobToken });
  const blob = page.blobs.find((item) => item.pathname === target);
  if (!blob) return null;
  const response = await get(blob.url, { access: "private", token: blobToken, useCache: false });
  if (!response || response.statusCode !== 200 || !response.stream) return null;
  return decryptWaitlistJson<BetaDownloadEntry>(await new Response(response.stream).text(), secret());
}

export async function saveBetaDownload(entry: BetaDownloadEntry): Promise<void> {
  if (supabaseConfigured()) {
    const { error } = await supabaseClient().from("beta_downloads").upsert({
      first_name: entry.firstName,
      email: entry.email.trim().toLowerCase(),
      platform: entry.platform,
      release: entry.release,
      referral_code: entry.referralCode,
      created_at: entry.createdAt,
      email_sent_at: entry.emailSentAt ?? null,
      email_message_id: entry.emailMessageId ?? null,
    }, { onConflict: "email,release" });
    if (error) throw new Error(`Supabase beta-download write failed: ${error.message}`);
    return;
  }
  const blobToken = token();
  if (blobToken && process.env.WAITLIST_ADMIN_TOKEN?.trim()) {
    await put(pathname(entry.email, entry.release), encryptWaitlistJson(entry, secret()), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
      token: blobToken,
    });
    return;
  }
  const entries = await readLocal();
  const index = entries.findIndex((item) => item.email === entry.email && item.release === entry.release);
  if (index >= 0) entries[index] = entry;
  else entries.push(entry);
  await writeLocal(entries);
}

export async function betaDownloadCount(): Promise<number> {
  if (supabaseConfigured()) {
    const { count, error } = await supabaseClient()
      .from("beta_downloads")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(`Supabase beta-download count failed: ${error.message}`);
    return count ?? 0;
  }
  const blobToken = token();
  if (!blobToken || !process.env.WAITLIST_ADMIN_TOKEN?.trim()) return (await readLocal()).length;
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor, token: blobToken });
    count += page.blobs.filter((item) => item.pathname.endsWith(".enc")).length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}

/** Delete one exact release request. Used only by the authenticated admin route. */
export async function deleteBetaDownload(email: string, release: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (supabaseConfigured()) {
    const { error } = await supabaseClient()
      .from("beta_downloads")
      .delete()
      .eq("email", normalizedEmail)
      .eq("release", release);
    if (error) throw new Error(`Supabase beta-download delete failed: ${error.message}`);
    return;
  }
  const blobToken = token();
  if (blobToken && process.env.WAITLIST_ADMIN_TOKEN?.trim()) {
    await del(pathname(normalizedEmail, release), { token: blobToken });
    return;
  }
  const entries = await readLocal();
  await writeLocal(entries.filter((entry) => !(entry.email === normalizedEmail && entry.release === release)));
}
