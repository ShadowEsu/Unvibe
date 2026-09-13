import { NextResponse } from "next/server";
import { suppressOutreachContact } from "@/lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const rawToken = contentType.includes("application/json")
    ? (await req.json().catch(() => null) as { token?: unknown } | null)?.token
    : (await req.formData().catch(() => null))?.get("token");
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token || token.length > 200) return NextResponse.json({ error: "Invalid unsubscribe request." }, { status: 400 });

  try {
    // The response is deliberately non-enumerating: a valid request always gets
    // the same acknowledgement whether it was already suppressed or not found.
    await suppressOutreachContact(token);
    return NextResponse.json({ unsubscribed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("outreach unsubscribe failed", error);
    return NextResponse.json({ error: "Could not process the unsubscribe request." }, { status: 503 });
  }
}
