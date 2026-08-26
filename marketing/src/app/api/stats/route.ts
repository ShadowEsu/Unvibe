import { NextResponse } from "next/server";
import { getBetaInstallCounts } from "@/lib/betaInstallStats";
import { getSiteStats } from "@/lib/siteStatsStore";
import { getPublicAnalytics } from "@/lib/publicAnalyticsStore";
import { getGrowthFunnel } from "@/lib/posthogFunnel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const stats = await getSiteStats();
    // The normal admin dashboard only needs traffic totals. Funnel aggregates
    // are opt-in to avoid loading waitlist storage for every dashboard refresh.
    const includeWaitlist = new URL(req.url).searchParams.get("include") === "waitlist";
    const publicAnalytics = includeWaitlist ? await getPublicAnalytics() : undefined;
    const installs = includeWaitlist ? await getBetaInstallCounts() : undefined;
    const funnel = includeWaitlist ? await getGrowthFunnel() : undefined;
    return NextResponse.json(
      { ok: true, stats, ...publicAnalytics, installs, funnel },
      {
        headers: {
          // Founder dashboard polls this; avoid CDN serving stale install/waitlist totals.
          "Cache-Control": includeWaitlist ? "no-store, private" : "public, s-maxage=15, stale-while-revalidate=45",
        },
      },
    );
  } catch (error) {
    console.error("stats load failed", error);
    return NextResponse.json({ error: "Could not load stats" }, { status: 500 });
  }
}
