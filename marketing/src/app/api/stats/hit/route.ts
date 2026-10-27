import { NextResponse } from "next/server";
import { parseVisitSource } from "@/lib/siteEvents";
import { recordSiteEvent, recordSiteHit } from "@/lib/siteStatsStore";
import { statsRequestRefusal } from "@/lib/statsRequestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let channelFailureLogged = false;

/**
 * One page view. `channel` (first-touch utm) comes only with the browser's first hit of its day
 * (visitHit.ts), so each one adds a visit_source count. A failed channel count, such as before
 * the site_events_daily migration is applied, never fails the hit; it is logged once per process.
 */
export async function POST(req: Request) {
  const refusal = statsRequestRefusal(req);
  if (refusal) return NextResponse.json({ ok: false }, { status: refusal });
  try {
    const body = (await req.json().catch(() => null)) as { visitorId?: unknown; channel?: unknown } | null;
    const visitorId = typeof body?.visitorId === "string" ? body.visitorId : "";
    if (!visitorId.trim()) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await recordSiteHit(visitorId);
    const channel = parseVisitSource(body?.channel);
    if (channel) {
      await recordSiteEvent(channel).catch((error: unknown) => {
        if (channelFailureLogged) return;
        channelFailureLogged = true;
        console.error("visit source count failed", error);
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("stats hit failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
