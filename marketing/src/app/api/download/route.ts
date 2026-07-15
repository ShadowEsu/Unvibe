import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DOWNLOAD_ASSETS, type DownloadPlatform } from "@/lib/downloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DownloadStats {
  mac: number;
  windows: number;
  total: number;
  events: Array<{ platform: DownloadPlatform; at: string; ua?: string }>;
}

function statsPath(): string {
  // On Vercel only /tmp is writable; locally use .data for durability.
  const base =
    process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? "/tmp"
      : path.join(process.cwd(), ".data");
  return path.join(base, "downloads.json");
}

async function readStats(): Promise<DownloadStats> {
  try {
    return JSON.parse(await fs.readFile(statsPath(), "utf8")) as DownloadStats;
  } catch {
    return { mac: 0, windows: 0, total: 0, events: [] };
  }
}

async function writeStats(stats: DownloadStats): Promise<void> {
  const file = statsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(stats, null, 2), "utf8");
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

function redirectToAsset(req: Request, platform: DownloadPlatform): Response {
  const asset = DOWNLOAD_ASSETS[platform];
  if (!asset?.href) {
    return NextResponse.json(
      { error: "download url not configured" },
      { status: 503 }
    );
  }
  const target = asset.href.startsWith("http")
    ? asset.href
    : new URL(asset.href, req.url).toString();
  return NextResponse.redirect(target, 302);
}

/** GET /api/download?platform=mac|windows — record then redirect to the installer. */
export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const platform = parsePlatform(searchParams.get("platform"));
    if (!platform) {
      return NextResponse.json(
        { error: "platform must be mac or windows" },
        { status: 400 }
      );
    }

    // Telemetry is best-effort and must never break the redirect.
    try {
      const ua = req.headers.get("user-agent");
      const stats = await readStats();
      stats[platform] += 1;
      stats.total += 1;
      stats.events.unshift({
        platform,
        at: new Date().toISOString(),
        ua: ua?.slice(0, 180) ?? undefined,
      });
      stats.events = stats.events.slice(0, 500);
      await writeStats(stats);
      await recordSupabase(platform, ua);
    } catch {
      // ignore
    }

    return redirectToAsset(req, platform);
  } catch (err) {
    console.error("[download]", err);
    return NextResponse.json(
      { error: "download failed" },
      { status: 500 }
    );
  }
}
