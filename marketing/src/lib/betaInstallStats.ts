import { promises as fs } from "node:fs";
import path from "node:path";
import { get, list, put } from "@vercel/blob";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type BetaInstallEvent = "copied" | "fetched" | "installed" | "survey";

export interface BetaInstallCounts {
  copied: number;
  fetched: number;
  installed: number;
  survey: number;
}

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
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function supabaseClient(): SupabaseClient {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
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
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
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

/** Prefer public access — private put/get 500s on public Blob stores. */
async function readBlob(): Promise<BetaInstallCounts> {
  const token = blobToken();
  const page = await list({ prefix: BLOB_PATH, limit: 1, token });
  const match = page.blobs.find((blob) => blob.pathname === BLOB_PATH);
  if (!match) return emptyCounts();
  for (const access of ["public", "private"] as const) {
    try {
      const result = await get(match.url, { access, token, useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) continue;
      return normalize(JSON.parse(await new Response(result.stream).text()) as Partial<BetaInstallCounts>);
    } catch {
      // Try the other access mode.
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

async function readSupabase(): Promise<BetaInstallCounts> {
  const { data, error } = await supabaseClient()
    .from("beta_install_counts")
    .select("copied,fetched,installed,survey")
    .eq("id", 1)
    .maybeSingle<BetaInstallCounts>();
  if (error) throw new Error(`Supabase install stats read failed: ${error.message}`);
  return normalize(data ?? undefined);
}

async function recordSupabase(event: BetaInstallEvent): Promise<BetaInstallCounts> {
  const { data, error } = await supabaseClient().rpc("record_beta_install_event", {
    p_event: event,
  });
  if (error) throw new Error(`Supabase install stats write failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return normalize(row as Partial<BetaInstallCounts> | null | undefined);
}

export function parseBetaInstallEvent(value: unknown): BetaInstallEvent | null {
  if (value === "copied" || value === "fetched" || value === "installed" || value === "survey") return value;
  return null;
}

export async function recordBetaInstallEvent(event: BetaInstallEvent): Promise<BetaInstallCounts> {
  if (supabaseConfigured()) {
    try {
      return await recordSupabase(event);
    } catch (error) {
      // Table may not exist yet on older deploys; fall through to Blob/local.
      console.error("supabase install stats write failed", error);
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

export async function getBetaInstallCounts(): Promise<BetaInstallCounts> {
  if (supabaseConfigured()) {
    try {
      return await readSupabase();
    } catch (error) {
      console.error("supabase install stats read failed", error);
    }
  }
  if (blobConfigured()) {
    try {
      return await readBlob();
    } catch (error) {
      console.error("blob install stats read failed", error);
    }
  }
  return readLocal();
}
