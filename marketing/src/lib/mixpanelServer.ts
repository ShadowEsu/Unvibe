/**
 * Best-effort server Mixpanel capture for events that must not depend on the browser.
 * Uses the Project Token (same as /api/analytics). Never throws. Never stores PII.
 */

type Props = Record<string, string | number | boolean | undefined>;

export async function captureMixpanelServerEvent(
  event: string,
  distinctId: string,
  props?: Props,
): Promise<void> {
  const token =
    process.env.MIXPANEL_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim();
  if (!token) return;

  const host = (process.env.MIXPANEL_HOST || "https://api.mixpanel.com").replace(/\/$/, "");
  const properties: Record<string, string | number | boolean> = {
    token,
    distinct_id: distinctId.slice(0, 80) || "server",
    time: Math.floor(Date.now() / 1000),
    source: "server",
  };
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined) properties[key] = value;
    }
  }

  try {
    const response = await fetch(`${host}/track?ip=0`, {
      method: "POST",
      headers: {
        accept: "text/plain",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ event, properties }]),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      console.error("mixpanel server capture rejected", response.status);
    }
  } catch (error) {
    console.error("mixpanel server capture failed", error);
  }
}
