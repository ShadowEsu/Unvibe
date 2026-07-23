import { NextResponse } from "next/server";
import { isWaitlistAdminAuthorized } from "@/lib/adminAuth";
import { getSiteStats } from "@/lib/siteStatsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isWaitlistAdminAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const stats = await getSiteStats();
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    console.error("stats load failed", error);
    return NextResponse.json({ error: "Could not load stats" }, { status: 500 });
  }
}
