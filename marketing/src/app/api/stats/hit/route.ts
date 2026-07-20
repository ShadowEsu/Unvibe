import { NextResponse } from "next/server";
import { recordSiteHit } from "@/lib/siteStatsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { visitorId?: unknown } | null;
    const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
    if (!visitorId.trim()) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await recordSiteHit(visitorId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("stats hit failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
