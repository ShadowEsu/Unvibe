import { NextResponse } from "next/server";
import { z } from "zod";
import { applyBuildAction, defaultBuildStatus, publicBuildStatus, type BuildAction } from "@/lib/buildStatus";
import { getBuildStatus, saveBuildStatus } from "@/lib/buildStatusStore";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), focus: z.string().max(80).optional(), note: z.string().max(220).optional() }),
  z.object({ action: z.literal("heartbeat") }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("update"), focus: z.string().min(1).max(80), note: z.string().max(220) }),
  z.object({ action: z.literal("set-total"), totalHours: z.number().min(0).max(100_000) }),
  z.object({
    action: z.literal("set-clock"),
    hours: z.number().min(0).max(100_000),
    minutes: z.number().min(0).max(59),
  }),
]);

export async function GET() {
  try {
    const status = publicBuildStatus(await getBuildStatus());
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      publicBuildStatus(defaultBuildStatus()),
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid build-status action." }, { status: 400 });
    }
    const next = applyBuildAction(await getBuildStatus(), parsed.data as BuildAction);
    await saveBuildStatus(next);
    return NextResponse.json(publicBuildStatus(next), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Live testing could not update. Try again." },
      { status: 500 },
    );
  }
}
