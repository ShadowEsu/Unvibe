/**
 * Test-only. Importing this unsets the analytics keys a developer shell may export, so a test run can't
 * send real events, and the vendor SDKs never start and keep the run from finishing. analytics.ts reads
 * its keys once, when it is loaded, so a `before` hook would be too late: import this first, above
 * anything that loads analytics.ts, and call restoreAnalyticsKeys() in `after`.
 */
export const ANALYTICS_KEYS = ["MIXPANEL_TOKEN", "NEXT_PUBLIC_MIXPANEL_TOKEN"] as const;

const saved = ANALYTICS_KEYS.map((name) => [name, process.env[name]] as const);
for (const name of ANALYTICS_KEYS) delete process.env[name];

export function restoreAnalyticsKeys(): void {
  for (const [name, value] of saved) {
    if (value !== undefined) process.env[name] = value;
  }
}
