import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DOWNLOAD_ASSETS, type DownloadPlatform } from "@/lib/downloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dataDir = path.join(process.cwd(), ".data");
const statsFile = path.join(dataDir, "downloads.json");

interface DownloadStats {
  mac: number;
  windows: number;
  total: number;
  events: Array<{ platform: DownloadPlatform; at: string; ua?: string }>;
}

async function readStats(): Promise<DownloadStats> {
  try {
    return JSON.parse(await fs.readFile(statsFile, "utf8")) as DownloadStats;
  } catch {
    return { mac: 0, windows: 0, total: 0, events: [] };
  }
}

async function writeStats(stats: DownloadStats): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(statsFile, JSON.stringify(stats, null, 2), "utf8");
}

async function recordSupabase(
  platform: DownloadPlatform,
  userAgent: string | null
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
    await supabase.from("download_events").insert({
      platform,
      user_agent: userAgent?.slice(0, 300) ?? null,
    });
  } catch {
    // Stats must never block the download.
  }
}

function parsePlatform(value: string | null): DownloadPlatform | null {
  if (value === "mac" || value === "windows") return value;
  return null;
}

/** GET /api/download?platform=mac|windows — record then redirect to the installer. */
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const platform = parsePlatform(searchParams.get("platform"));
  if (!platform) {
    return NextResponse.json(
      { error: "platform must be mac or windows" },
      { status: 400 }
    );
  }

  const ua = req.headers.get("user-agent");
  const stats = await readStats();
  stats[platform] += 1;
  stats.total += 1;
  stats.events.unshift({
    platform,
    at: new Date().toISOString(),
    ua: ua?.slice(0, 180),
  });
  stats.events = stats.events.slice(0, 500);
  await writeStats(stats);
  await recordSupabase(platform, ua);

  const asset = DOWNLOAD_ASSETS[platform];
  return NextResponse.redirect(new URL(asset.href, req.url), 302);
}
