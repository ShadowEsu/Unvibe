import { NextResponse } from "next/server";
import {
  parseFunnelTrackEvent,
  recordGrowthFunnelEvent,
} from "@/lib/growthFunnelStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      event?: unknown;
      distinctId?: unknown;
    } | null;
    const event = parseFunnelTrackEvent(body?.event);
    if (!event) return NextResponse.json({ ok: false }, { status: 400 });
    const distinctId = typeof body?.distinctId === "string" ? body.distinctId : "anon";
    const funnel = await recordGrowthFunnelEvent(event, distinctId);
    return NextResponse.json({ ok: true, funnel });
  } catch (error) {
    console.error("funnel event failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
