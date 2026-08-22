/** Minimal server-side PostHog capture for conversion events. Never sends PII or code. */
type Value = string | number | boolean;

export async function captureMarketingEvent(event: string, properties: Record<string, Value> = {}): Promise<void> {
  const key = process.env.POSTHOG_API_KEY?.trim();
  if (!key) return;
  try {
    await fetch(`${(process.env.POSTHOG_HOST?.trim() || 'https://us.i.posthog.com').replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: process.env.POSTHOG_SERVER_DISTINCT_ID?.trim() || 'unvibe-marketing-server',
        properties,
      }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Analytics is best effort and must never interrupt signup or delivery.
  }
}
