import { NextResponse } from "next/server";
import { deleteWaitlistEntry, listWaitlistEntries } from "@/lib/waitlistStore";
import { isProbeWaitlistEmail } from "@/lib/waitlistProbes";
import { isWaitlistAdminAuthorized } from "@/lib/adminAuth";

const PRIVATE_HEADERS = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" };

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Names and emails are private: requires the WAITLIST_ADMIN_TOKEN bearer. */
export async function GET(request: Request) {
  if (!isWaitlistAdminAuthorized(request.headers.get("authorization"))) return unauthorized();
  try {
    const entries = (await listWaitlistEntries(10_000)).filter(
      (entry) => !isProbeWaitlistEmail(entry.email, `${entry.firstName} ${entry.lastName}`),
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
  if (!isWaitlistAdminAuthorized(request.headers.get("authorization"))) return unauthorized();
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
