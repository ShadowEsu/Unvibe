import { isBetaInstallStatsEmail } from "@/lib/betaInstallStats";

/** Test and agent probe signups that must not inflate founder waitlist totals. */
export function isProbeWaitlistEmail(email: string | null | undefined, name?: string): boolean {
  const e = (email ?? "").trim().toLowerCase();
  const n = (name ?? "").trim().toLowerCase();
  if (!e) return true;
  if (isBetaInstallStatsEmail(e)) return true;
  return (
    e.includes("probe") ||
    e.includes("gauge") ||
    e.includes("livecheck") ||
    e.endsWith("@example.com") ||
    e.endsWith("@example.invalid") ||
    e.endsWith("@unvibe.test") ||
    e.endsWith("@unvibe.dev") ||
    n.includes("probe") ||
    n.includes("gauge") ||
    n === "name unavailable"
  );
}
