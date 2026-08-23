/**
 * Best-effort server PostHog capture for events that must not depend on the browser.
 * Never throws. Never stores PII in properties.
 */

type Props = Record<string, string | number | boolean | undefined>;

export async function captureServerEvent(
  event: string,
  distinctId: string,
  props?: Props,
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!apiKey) return;

  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  const properties: Record<string, string | number | boolean> = {
    source: "server",
  };
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined) properties[key] = value;
    }
  }

  try {
    await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId.slice(0, 80) || "server",
        properties,
        timestamp: new Date().toISOString(),
      }),
      // Vercel serverless: do not hang the response on analytics.
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Analytics must never break signup.
  }
}
