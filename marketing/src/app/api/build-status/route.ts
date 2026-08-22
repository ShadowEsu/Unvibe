import { NextResponse } from "next/server";
import { z } from "zod";
import { applyBuildAction, publicBuildStatus, stopBuildSession, type BuildAction } from "@/lib/buildStatus";
import { BUILD_STATUS_STORAGE_ERROR, BUILD_STATUS_STORAGE_ERROR_CODE } from "@/lib/buildStatusError";
import { getBuildStatus, saveBuildStatus } from "@/lib/buildStatusStore";
import { verifyFounderRequest } from "@/lib/founderAuth";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), focus: z.string().max(80).optional(), note: z.string().max(220).optional() }),
  z.object({ action: z.literal("heartbeat") }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("update"), focus: z.string().min(1).max(80), note: z.string().max(220) }),
  z.object({ action: z.literal("set-total"), totalHours: z.number().min(0).max(100_000) }),
]);

export async function GET() {
  try {
    const status = publicBuildStatus(await getBuildStatus());
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to read founder build status", error);
    return NextResponse.json(
      { error: BUILD_STATUS_STORAGE_ERROR, code: BUILD_STATUS_STORAGE_ERROR_CODE },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  if (!(await verifyFounderRequest(request))) {
    return NextResponse.json({ error: "Founder authorization required." }, { status: 401 });
  }
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid build-status action." }, { status: 400 });
  }
  try {
    const current = await getBuildStatus();
    let next;
    if (parsed.data.action === "heartbeat") {
      next = current;
    } else if (parsed.data.action === "stop") {
      next = stopBuildSession(current);
      await saveBuildStatus(next);
    } else {
      next = applyBuildAction(current, parsed.data as BuildAction);
      await saveBuildStatus(next);
    }
    return NextResponse.json(publicBuildStatus(next), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Keep storage implementation details out of the founder-facing UI while
    // retaining the underlying failure in server logs for diagnosis.
    console.error("Unable to persist founder build status", error);
    return NextResponse.json(
      { error: BUILD_STATUS_STORAGE_ERROR, code: BUILD_STATUS_STORAGE_ERROR_CODE },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
