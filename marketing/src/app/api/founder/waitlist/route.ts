import { NextResponse } from "next/server";
import { deleteWaitlistEntry, listWaitlistEntries } from "@/lib/waitlistStore";
import { isBetaInstallStatsEmail } from "@/lib/betaInstallStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = (await listWaitlistEntries(10_000)).filter(
      (entry) => !isBetaInstallStatsEmail(entry.email),
    );
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

/** Remove a signup (test emails, duplicates). Same private founder surface as GET. */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  if (typeof body?.email !== "string" || !body.email.trim()) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 422, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } },
    );
  }

  try {
    const deleted = await deleteWaitlistEntry(body.email);
    if (!deleted) {
      return NextResponse.json(
        { error: "Signup not found" },
        { status: 404, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } },
      );
    }
    return NextResponse.json(
      { ok: true, deleted: true, email: body.email.trim().toLowerCase() },
      { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } },
    );
  } catch (error) {
    console.error("founder waitlist delete failed", error);
    return NextResponse.json(
      { error: "Could not delete signup." },
      { status: 500, headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" } },
    );
  }
}
