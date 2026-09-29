/**
 * Desktop install counts from the product backend (web/ /api/v1/admin/stats).
 * Needs UNVIBE_API_URL and UNVIBE_ADMIN_STATS_TOKEN on the marketing deployment.
 */
export interface AppUserStats {
  installs: number;
  newToday: number;
  new7d: number;
  new30d: number;
  active7d: number;
  active30d: number;
  source: "blob" | "unavailable" | "not_configured" | "error";
}

const EMPTY = { installs: 0, newToday: 0, new7d: 0, new30d: 0, active7d: 0, active30d: 0 };

export async function getAppUserStats(): Promise<AppUserStats> {
  const base = process.env.UNVIBE_API_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UNVIBE_ADMIN_STATS_TOKEN?.trim();
  if (!base || !token) return { ...EMPTY, source: "not_configured" };
  try {
    const response = await fetch(`${base}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`backend ${response.status}`);
    const body = (await response.json()) as Partial<AppUserStats>;
    return {
      installs: Number(body.installs) || 0,
      newToday: Number(body.newToday) || 0,
      new7d: Number(body.new7d) || 0,
      new30d: Number(body.new30d) || 0,
      active7d: Number(body.active7d) || 0,
      active30d: Number(body.active30d) || 0,
      source: body.source === "blob" ? "blob" : "unavailable",
    };
  } catch (error) {
    console.error("app user stats failed", error);
    return { ...EMPTY, source: "error" };
  }
}
