import { promises as fs } from "node:fs";
import path from "node:path";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { decryptWaitlistJson, encryptWaitlistJson } from "@/lib/waitlistCrypto";

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
  referralCode: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdAt: string;
  notification?: WaitlistNotificationRecord;
}

export interface WaitlistAdminEntry extends WaitlistEntry {
  id: string;
}

const BLOB_PATH = "waitlist/entries.v1.enc";
const MAX_WRITE_ATTEMPTS = 5;
const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "waitlist.json");

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function storageSecret(): string {
  const secret = process.env.WAITLIST_ADMIN_TOKEN?.trim();
  if (!secret) throw new Error("Waitlist encryption is not configured");
  return secret;
}

async function readBlob(): Promise<{ entries: WaitlistEntry[]; etag?: string }> {
  const result = await get(BLOB_PATH, { access: "public", useCache: false });
  if (!result) return { entries: [] };
  if (result.statusCode !== 200) throw new Error("Waitlist storage returned an unexpected response");
  const body = await new Response(result.stream).text();
  const parsed: unknown = decryptWaitlistJson(body, storageSecret());
  if (!Array.isArray(parsed)) throw new Error("Waitlist storage contains invalid data");
  return { entries: parsed as WaitlistEntry[], etag: result.blob.etag };
}

async function writeBlob(entries: WaitlistEntry[], etag?: string): Promise<void> {
  await put(BLOB_PATH, encryptWaitlistJson(entries, storageSecret()), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: Boolean(etag),
    cacheControlMaxAge: 60,
    contentType: "application/octet-stream",
    ...(etag ? { ifMatch: etag } : {}),
  });
}

async function readLocal(): Promise<WaitlistEntry[]> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return Array.isArray(parsed) ? parsed as WaitlistEntry[] : [];
  } catch {
    return [];
  }
}

async function writeLocal(entries: WaitlistEntry[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(entries, null, 2), "utf8");
}

function isRetryableWrite(error: unknown): boolean {
  return error instanceof BlobPreconditionFailedError ||
    (error instanceof Error && /already exists|precondition|conflict/i.test(error.message));
}

async function updateBlob(
  mutate: (entries: WaitlistEntry[]) => { changed: boolean; result: boolean }
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const current = await readBlob();
    const outcome = mutate(current.entries);
    if (!outcome.changed) return outcome.result;
    try {
      await writeBlob(current.entries, current.etag);
      return outcome.result;
    } catch (error) {
      if (!isRetryableWrite(error) || attempt === MAX_WRITE_ATTEMPTS - 1) throw error;
    }
  }
  throw new Error("Waitlist storage could not resolve a concurrent update");
}

export async function saveWaitlistEntry(
  entry: WaitlistEntry
): Promise<{ duplicate: boolean; storage: "blob" | "local" }> {
  if (blobConfigured()) {
    const inserted = await updateBlob((entries) => {
      if (entries.some((item) => item.email === entry.email)) {
        return { changed: false, result: false };
      }
      entries.push(entry);
      return { changed: true, result: true };
    });
    return { duplicate: !inserted, storage: "blob" };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Durable waitlist storage is not configured");
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
  details: { tool?: string; experience?: string; message?: string }
): Promise<boolean> {
  if (blobConfigured()) {
    return updateBlob((entries) => {
      const entry = entries.find((item) => item.email === email);
      if (!entry) return { changed: false, result: false };
      entry.tool = details.tool;
      entry.experience = details.experience;
      entry.message = details.message || undefined;
      return { changed: true, result: true };
    });
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
  notification: WaitlistNotificationRecord
): Promise<void> {
  if (blobConfigured()) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const updated = await updateBlob((entries) => {
        const entry = entries.find((item) => item.email === email);
        if (!entry) return { changed: false, result: false };
        entry.notification = notification;
        return { changed: true, result: true };
      });
      if (updated) return;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
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
  const entries = blobConfigured()
    ? (await readBlob()).entries
    : await readLocal();
  if (!blobConfigured() && process.env.NODE_ENV === "production") {
    throw new Error("Durable waitlist storage is not configured");
  }
  return entries
    .map((entry) => ({ ...entry, id: entry.referralCode }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
