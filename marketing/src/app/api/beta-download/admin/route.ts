import { NextResponse } from "next/server";
import { isWaitlistAdminAuthorized } from "@/lib/adminAuth";
import { betaDownloadCount } from "@/lib/betaDownloadStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isWaitlistAdminAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(
      { uniqueBetaRequests: await betaDownloadCount(), generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } },
    );
  } catch (error) {
    console.error("beta download count failed", error);
    return NextResponse.json({ error: "Could not load beta download count" }, { status: 500 });
  }
}
