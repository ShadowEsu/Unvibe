import { CSP_REPORT_TYPES, createCspCollector, readCappedBody, violationsFrom } from "@/lib/cspReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One collector per server instance: its per-minute cap is per instance.
const collector = createCspCollector();

/** Browsers' CSP violation reports (report-uri and report-to). No cookies or session are read. */
export async function POST(req: Request): Promise<Response> {
  const type = (req.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!CSP_REPORT_TYPES.has(type)) return new Response(null, { status: 415 });
  const text = await readCappedBody(req);
  if (text === null) return new Response(null, { status: 413 });
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  collector.add(violationsFrom(body, type));
  return new Response(null, { status: 204 });
}
