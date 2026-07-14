import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statsFile = path.join(process.cwd(), ".data", "downloads.json");

interface DownloadStats {
  mac: number;
  windows: number;
  total: number;
}

async function readLocal(): Promise<DownloadStats> {
  try {
    const raw = JSON.parse(await fs.readFile(statsFile, "utf8")) as DownloadStats;
    return {
      mac: Number(raw.mac) || 0,
      windows: Number(raw.windows) || 0,
      total: Number(raw.total) || 0,
    };
  } catch {
    return { mac: 0, windows: 0, total: 0 };
  }
}

async function readSupabase(): Promise<DownloadStats | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.from("download_events").select("platform");
    if (error || !data) return null;
    const mac = data.filter((r) => r.platform === "mac").length;
    const windows = data.filter((r) => r.platform === "windows").length;
    return { mac, windows, total: mac + windows };
  } catch {
    return null;
  }
}

export async function GET(): Promise<Response> {
  const fromSupabase = await readSupabase();
  const stats = fromSupabase ?? (await readLocal());
  return NextResponse.json({
    ...stats,
    version: "1.0.0",
  });
}
