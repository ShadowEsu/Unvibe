import { promises as fs } from "node:fs";
import path from "node:path";
import { del, list, put } from "@vercel/blob";
import { createHash } from "node:crypto";
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

const ENTRY_PREFIX = "waitlist/item/";
const LEGACY_BLOB_PATH = "waitlist/entries.v2.enc";
const LEGACY_BLOB_PATH_V1 = "waitlist/entries.v1.enc";
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
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/octet-stream",
    token: blobToken(),
  });
}

async function readEntryBlob(url: string): Promise<WaitlistEntry | null> {
  const downloadUrl = new URL(url);
  downloadUrl.searchParams.set("download", "1");
  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${blobToken()}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Waitlist storage returned an unexpected response");
  const body = await response.text();
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
): Promise<{ duplicate: boolean; storage: "blob" | "local" }> {
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

export async function updateWaitlistDetails(
  email: string,
  details: { tool?: string; experience?: string; message?: string },
): Promise<boolean> {
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

export async function deleteWaitlistEntry(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

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
