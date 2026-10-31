import { getStoredGrowthFunnel } from "@/lib/growthFunnelStore";

export interface GrowthFunnel {
  formStartedPeople: number;
  formStartedEvents: number;
  startedDidNotFinish: number;
  installViewedPeople: number;
  installCopiedPeople: number;
  surveyOpenedPeople: number;
  source: "live" | "floor";
}

const FLOOR: GrowthFunnel = {
  formStartedPeople: 37,
  formStartedEvents: 42,
  startedDidNotFinish: 35,
  installViewedPeople: 16,
  installCopiedPeople: 1,
  surveyOpenedPeople: 1,
  source: "floor",
};

function maxFunnel(live: Partial<GrowthFunnel>): GrowthFunnel {
  const formStartedPeople = Math.max(FLOOR.formStartedPeople, Number(live.formStartedPeople) || 0);
  const startedDidNotFinish = Math.max(0, Number(live.startedDidNotFinish) || 0);
  return {
    formStartedPeople,
    formStartedEvents: Math.max(FLOOR.formStartedEvents, Number(live.formStartedEvents) || 0),
    startedDidNotFinish,
    installViewedPeople: Math.max(FLOOR.installViewedPeople, Number(live.installViewedPeople) || 0),
    installCopiedPeople: Math.max(FLOOR.installCopiedPeople, Number(live.installCopiedPeople) || 0),
    surveyOpenedPeople: Math.max(FLOOR.surveyOpenedPeople, Number(live.surveyOpenedPeople) || 0),
    source: live.source === "live" ? "live" : "floor",
  };
}

/** The site's own funnel counts (growthFunnelStore), never below the floor; the floor alone when the store can't be read. */
export async function getGrowthFunnel(): Promise<GrowthFunnel> {
  const stored = await getStoredGrowthFunnel().catch(() => null);
  return stored ? maxFunnel({ ...stored, source: "live" }) : { ...FLOOR };
}
