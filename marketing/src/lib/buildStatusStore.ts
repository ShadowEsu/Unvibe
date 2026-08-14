import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { defaultBuildStatus, normalizeBuildStatus, type BuildStatus } from "@/lib/buildStatus";

const localFile = path.join(process.cwd(), ".data", "build-status.json");
const BUCKET = "unvibe-timer";
const OBJECT_PATH = "public/build-status.v1.json";

let cachedSupabase: SupabaseClient | null = null;

function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function supabaseClient(): SupabaseClient {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase build-status storage is not configured");
  cachedSupabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedSupabase;
}

async function ensureTimerBucket(): Promise<void> {
  const client = supabaseClient();
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(`Supabase timer bucket lookup failed: ${listError.message}`);
  if (buckets.some((bucket) => bucket.id === BUCKET)) return;

  const { error: createError } = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: "1024",
  });
  // Another request may have created the bucket after the initial list.
  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    throw new Error(`Supabase timer bucket creation failed: ${createError.message}`);
  }
}

async function readSupabase(): Promise<BuildStatus> {
  const client = supabaseClient();
  await ensureTimerBucket();
  const { data, error } = await client.storage.from(BUCKET).download(OBJECT_PATH);
  if (error) {
    if (/not found|object not found/i.test(error.message)) return defaultBuildStatus();
    throw new Error(`Supabase timer read failed: ${error.message}`);
  }
  const parsed: unknown = JSON.parse(await data.text());
  return normalizeBuildStatus(parsed && typeof parsed === "object" ? parsed as Partial<BuildStatus> : null);
}

async function writeSupabase(status: BuildStatus): Promise<void> {
  const client = supabaseClient();
  await ensureTimerBucket();
  const { error } = await client.storage.from(BUCKET).upload(
    OBJECT_PATH,
    JSON.stringify(status),
    {
      contentType: "application/json",
      upsert: true,
      cacheControl: "0",
    },
  );
  if (error) throw new Error(`Supabase timer write failed: ${error.message}`);
}

async function readLocal(): Promise<BuildStatus> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(localFile, "utf8"));
    return normalizeBuildStatus(parsed && typeof parsed === "object" ? parsed as Partial<BuildStatus> : null);
  } catch {
    return defaultBuildStatus();
  }
}

async function writeLocal(status: BuildStatus): Promise<void> {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  await fs.writeFile(localFile, JSON.stringify(status, null, 2), "utf8");
}

export async function getBuildStatus(): Promise<BuildStatus> {
  return supabaseConfigured() ? readSupabase() : readLocal();
}

export async function saveBuildStatus(status: BuildStatus): Promise<void> {
  if (supabaseConfigured()) await writeSupabase(status);
  else await writeLocal(status);
}
