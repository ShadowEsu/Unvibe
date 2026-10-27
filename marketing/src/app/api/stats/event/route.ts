import { NextResponse } from "next/server";
import { parseSiteCount } from "@/lib/siteEvents";
import { recordSiteEvent } from "@/lib/siteStatsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** First-party daily count of a download click: `{event, surface, platform}`, see siteEvents.ts. */
export async function POST(req: Request) {
  try {
    const count = parseSiteCount(await req.json().catch(() => null));
    if (!count) return NextResponse.json({ ok: false }, { status: 400 });
    await recordSiteEvent(count);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("site event failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
