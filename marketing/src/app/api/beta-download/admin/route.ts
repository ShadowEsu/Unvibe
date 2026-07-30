import { NextResponse } from "next/server";
import { isWaitlistAdminAuthorized } from "@/lib/adminAuth";
import { betaDownloadCount, deleteBetaDownload } from "@/lib/betaDownloadStore";

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

export async function DELETE(request: Request) {
  if (!isWaitlistAdminAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { email?: unknown; release?: unknown } | null;
  if (typeof body?.email !== "string" || !body.email.includes("@") || typeof body.release !== "string" || body.release.length > 80) {
    return NextResponse.json({ error: "A valid email and release are required" }, { status: 422 });
  }
  try {
    await deleteBetaDownload(body.email, body.release);
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("beta download delete failed", error);
    return NextResponse.json({ error: "Could not delete beta download request" }, { status: 500 });
  }
}
