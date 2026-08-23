import { NextResponse } from "next/server";
import { listWaitlistEntries } from "@/lib/waitlistStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await listWaitlistEntries(10_000);
    return NextResponse.json(
      {
        ok: true,
        total: entries.length,
        entries: entries.map((entry) => ({
          name: [entry.firstName, entry.lastName].filter(Boolean).join(" ") || "Name unavailable",
          email: entry.email,
          joinedAt: entry.createdAt,
          tool: entry.tool || "Not given",
        })),
      },
      { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } },
    );
  } catch (error) {
    console.error("founder waitlist list failed", error);
    return NextResponse.json(
      { error: "Could not load waitlist names." },
      { status: 500, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } },
    );
  }
}
