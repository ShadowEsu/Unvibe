import type { WaitlistEntry } from "@/lib/waitlistStore";

export interface AttributionRow {
  label: string;
  signups: number;
  referrals: number;
}

function valueOrFallback(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** Founder-only aggregation for deciding where to invest the next growth cycle. */
export function summarizeWaitlistAttribution(entries: WaitlistEntry[]): AttributionRow[] {
  const grouped = new Map<string, AttributionRow>();
  for (const entry of entries) {
    const source = valueOrFallback(entry.utmSource, "Direct / unknown");
    const medium = valueOrFallback(entry.utmMedium, "organic");
    const campaign = entry.utmCampaign?.trim();
    const label = campaign ? `${source} · ${medium} · ${campaign}` : `${source} · ${medium}`;
    const current = grouped.get(label) ?? { label, signups: 0, referrals: 0 };
    current.signups += 1;
    if (entry.referredBy?.trim()) current.referrals += 1;
    grouped.set(label, current);
  }
  return Array.from(grouped.values()).sort((a, b) => b.signups - a.signups || b.referrals - a.referrals || a.label.localeCompare(b.label));
}
