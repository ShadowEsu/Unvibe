import { NextResponse } from "next/server";
import { isWaitlistAdminAuthorized } from "@/lib/adminAuth";
import { getAppUserStats } from "@/lib/appUserStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" };

/** Founder-only app user counts. Requires the WAITLIST_ADMIN_TOKEN bearer. */
export async function GET(request: Request) {
  if (!isWaitlistAdminAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: HEADERS });
  }
  return NextResponse.json({ ok: true, appUsers: await getAppUserStats() }, { headers: HEADERS });
}
