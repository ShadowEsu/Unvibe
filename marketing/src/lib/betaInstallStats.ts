import { promises as fs } from "node:fs";
import path from "node:path";
import { get, list, put } from "@vercel/blob";

export type BetaInstallEvent = "copied" | "fetched" | "installed";

export interface BetaInstallCounts {
  copied: number;
  fetched: number;
  installed: number;
}

const BLOB_PATH = "stats/beta-install.v1.json";
const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "beta-install.json");

function emptyCounts(): BetaInstallCounts {
  return { copied: 0, fetched: 0, installed: 0 };
}

function normalize(parsed: Partial<BetaInstallCounts> | null | undefined): BetaInstallCounts {
  return {
    copied: Number(parsed?.copied) || 0,
    fetched: Number(parsed?.fetched) || 0,
    installed: Number(parsed?.installed) || 0,
  };
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("Durable install stats storage is not configured");
  return token;
}

async function readLocal(): Promise<BetaInstallCounts> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    return normalize(JSON.parse(raw) as Partial<BetaInstallCounts>);
  } catch {
    return emptyCounts();
  }
}

async function writeLocal(data: BetaInstallCounts): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(data));
}

async function readBlob(): Promise<BetaInstallCounts> {
  const token = blobToken();
  const page = await list({ prefix: BLOB_PATH, limit: 1, token });
  const match = page.blobs.find((blob) => blob.pathname === BLOB_PATH);
  if (!match) return emptyCounts();
  const result = await get(match.url, { access: "private", token, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return emptyCounts();
  return normalize(JSON.parse(await new Response(result.stream).text()) as Partial<BetaInstallCounts>);
}

async function writeBlob(data: BetaInstallCounts): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
    token: blobToken(),
  });
}

async function load(): Promise<BetaInstallCounts> {
  return blobConfigured() ? readBlob() : readLocal();
}

async function save(data: BetaInstallCounts): Promise<void> {
  if (blobConfigured()) await writeBlob(data);
  else await writeLocal(data);
}

export function parseBetaInstallEvent(value: unknown): BetaInstallEvent | null {
  if (value === "copied" || value === "fetched" || value === "installed") return value;
  return null;
}

export async function recordBetaInstallEvent(event: BetaInstallEvent): Promise<BetaInstallCounts> {
  const data = await load();
  data[event] += 1;
  await save(data);
  return data;
}

export async function getBetaInstallCounts(): Promise<BetaInstallCounts> {
  return load();
}
