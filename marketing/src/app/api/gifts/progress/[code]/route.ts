import { NextResponse } from "next/server";
import { webAppBackendUrl } from "@/lib/webAppBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, max: 40 };
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const prior = hits.get(ip);
  if (!prior || prior.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  prior.count += 1;
  return prior.count > RATE_LIMIT.max;
}

export async function GET(request: Request, { params }: { params: { code: string } }) {
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: "Please try again shortly." }, { status: 429 });
  }
  try {
    const response = await fetch(`${webAppBackendUrl()}/api/v1/gifts/progress/${encodeURIComponent(params.code)}`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch {
    return NextResponse.json({ error: "Could not load gift progress." }, { status: 503 });
  }
}
