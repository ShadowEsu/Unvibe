import { NextResponse } from "next/server";
import { webAppBackendUrl } from "@/lib/webAppBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const body = await request.json().catch(() => ({}));
  try {
    const response = await fetch(`${webAppBackendUrl()}/api/v1/auth/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach the Unvibe service." }, { status: 503 });
  }
}
