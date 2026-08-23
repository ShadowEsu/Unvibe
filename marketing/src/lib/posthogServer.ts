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
  const apiKey =
    process.env.POSTHOG_PROJECT_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!apiKey) return;

  const host = (
    process.env.POSTHOG_HOST ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    "https://us.i.posthog.com"
  ).replace(/\/$/, "");
  const properties: Record<string, string | number | boolean> = {
    source: "server",
  };
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined) properties[key] = value;
    }
  }

  try {
    const response = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId.slice(0, 80) || "server",
        properties,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      console.error("posthog server capture rejected", response.status);
    }
  } catch (error) {
    console.error("posthog server capture failed", error);
  }
}
