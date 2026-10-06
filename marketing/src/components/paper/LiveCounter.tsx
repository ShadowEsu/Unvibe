import { getSiteStats } from "@/lib/siteStatsStore";
import { getDownloadStats } from "@/lib/downloadStats";

/** Real numbers only: site visitors from our own counter and installer downloads from GitHub. */
export async function LiveCounter() {
  const [stats, downloads] = await Promise.all([
    getSiteStats().catch(() => null),
    getDownloadStats().catch(() => null),
  ]);
  const parts: Array<[number, string]> = [];
  if (stats && stats.today.visitors > 0) parts.push([stats.today.visitors, "people here today"]);
  if (stats && stats.week.visitors > 0) parts.push([stats.week.visitors, "this week"]);
  if (downloads && downloads.source === "github" && downloads.total > 0) parts.push([downloads.total, "installer downloads"]);
  if (!parts.length) return null;
  return (
    <div className="live" aria-label="Live numbers">
      <span className="live__dot" aria-hidden="true" />
      <span className="live__label">Live</span>
      {parts.map(([value, label]) => (
        <span key={label} className="live__item"><b>{value.toLocaleString("en-US")}</b> {label}</span>
      ))}
    </div>
  );
}
