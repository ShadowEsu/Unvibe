import { NextResponse } from "next/server";
import { ANALYTICS_EVENT_SET } from "@/lib/analyticsEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIXPANEL_HOST = process.env.MIXPANEL_HOST || "https://api.mixpanel.com";

const BLOCKED_PROP_KEY = /email|name|phone|secret|password|token|authorization/i;

type Primitive = string | number | boolean;

function mixpanelToken(): string | undefined {
  return process.env.MIXPANEL_TOKEN;
}

function asDistinctId(value: unknown): string {
  if (typeof value !== "string") return "anon";
  const trimmed = value.trim().slice(0, 80);
  return trimmed || "anon";
}

function sanitizedProperties(input: unknown): Record<string, Primitive> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= 20) break;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
    if (BLOCKED_PROP_KEY.test(key)) continue;
    if (typeof value === "string") {
      out[key] = value.slice(0, 200);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export async function POST(req: Request) {
  const token = mixpanelToken();
  if (!token) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      event?: unknown;
      distinctId?: unknown;
      properties?: unknown;
    } | null;
    const event = typeof body?.event === "string" ? body.event : "";
    if (!ANALYTICS_EVENT_SET.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const payload = [
      {
        event,
        properties: {
          ...sanitizedProperties(body?.properties),
          token,
          distinct_id: asDistinctId(body?.distinctId),
          time: Math.floor(Date.now() / 1000),
        },
      },
    ];

    const response = await fetch(`${MIXPANEL_HOST}/track?ip=1`, {
      method: "POST",
      headers: {
        accept: "text/plain",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return NextResponse.json({ ok: false }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("mixpanel track failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
