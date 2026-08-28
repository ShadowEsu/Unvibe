import { getStoredGrowthFunnel } from "@/lib/growthFunnelStore";

export interface GrowthFunnel {
  formStartedPeople: number;
  formStartedEvents: number;
  startedDidNotFinish: number;
  installViewedPeople: number;
  installCopiedPeople: number;
  surveyOpenedPeople: number;
  source: "posthog" | "live" | "floor";
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

function usable(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "[SENSITIVE]" || trimmed.toLowerCase() === "sensitive") return undefined;
  return trimmed;
}

function personalKey(): string | undefined {
  return usable(process.env.POSTHOG_PERSONAL_API_KEY);
}

function projectId(): string {
  return usable(process.env.POSTHOG_PROJECT_ID) || "562518";
}

function appHost(): string {
  return (usable(process.env.POSTHOG_APP_HOST) || "https://us.posthog.com").replace(/\/$/, "");
}

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
    source: live.source === "posthog" ? "posthog" : live.source === "live" ? "live" : "floor",
  };
}

async function hogql(query: string): Promise<unknown[][] | null> {
  const key = personalKey();
  if (!key) return null;
  try {
    const response = await fetch(`${appHost()}/api/projects/${projectId()}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { kind: "HogQLQuery", query },
        name: "founder-growth-funnel",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      console.error("posthog funnel query rejected", response.status);
      return null;
    }
    const payload = (await response.json()) as { results?: unknown[][] };
    return Array.isArray(payload.results) ? payload.results : null;
  } catch (error) {
    console.error("posthog funnel query failed", error);
    return null;
  }
}

export async function getGrowthFunnel(): Promise<GrowthFunnel> {
  const stored = await getStoredGrowthFunnel().catch(() => null);
  const rows = await hogql(`
    SELECT
      uniqIf(person_id, event = 'waitlist_started') AS formStartedPeople,
      countIf(event = 'waitlist_started') AS formStartedEvents,
      uniqIf(person_id, event = 'waitlist_completed') AS formCompletedPeople,
      uniqIf(person_id, event = 'beta_install_viewed') AS installViewedPeople,
      uniqIf(person_id, event = 'beta_install_copied' AND coalesce(properties.source, '') != 'api') AS installCopiedPeople,
      uniqIf(person_id, event = 'survey_opened' AND coalesce(properties.source, '') != 'api' AND coalesce(properties.source, '') != 'feedback_route') AS surveyOpenedPeople
    FROM events
    WHERE timestamp >= toDateTime('2026-08-01 00:00:00')
      AND event IN ('waitlist_started', 'waitlist_completed', 'beta_install_viewed', 'beta_install_copied', 'survey_opened')
  `);
  const row = rows?.[0];
  const live = stored
    ? maxFunnel({ ...stored, source: "live" })
    : { ...FLOOR };
  if (!row) return live;
  const formStartedPeople = Math.max(live.formStartedPeople, Number(row[0]) || 0);
  const formStartedEvents = Math.max(live.formStartedEvents, Number(row[1]) || 0);
  const formCompletedPeople = Number(row[2]) || 0;
  const storedCompleted = Math.max(0, live.formStartedPeople - live.startedDidNotFinish);
  const completed = Math.max(storedCompleted, formCompletedPeople);
  return maxFunnel({
    formStartedPeople,
    formStartedEvents,
    startedDidNotFinish: Math.max(0, formStartedPeople - completed),
    installViewedPeople: Math.max(live.installViewedPeople, Number(row[3]) || 0),
    installCopiedPeople: Math.max(live.installCopiedPeople, Number(row[4]) || 0),
    surveyOpenedPeople: Math.max(live.surveyOpenedPeople, Number(row[5]) || 0),
    source: "posthog",
  });
}
