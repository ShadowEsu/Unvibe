import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
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
  const blobToken = token();
  if (blobToken && process.env.WAITLIST_ADMIN_TOKEN?.trim()) {
    await del(pathname(normalizedEmail, release), { token: blobToken });
    return;
  }
  const entries = await readLocal();
  await writeLocal(entries.filter((entry) => !(entry.email === normalizedEmail && entry.release === release)));
}
