import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  findWaitlistEntry,
  saveWaitlistEntry,
  updateWaitlistDetails,
} from "@/lib/waitlistStore";

export const GROWTH_FUNNEL_EMAIL = "growth-funnel@unvibe.internal";

export const FUNNEL_TRACK_EVENTS = [
  "waitlist_started",
  "waitlist_completed",
  "beta_install_viewed",
  "beta_install_copied",
  "survey_opened",
] as const;

export type FunnelTrackEvent = (typeof FUNNEL_TRACK_EVENTS)[number];

export interface StoredGrowthFunnel {
  formStartedPeople: number;
  formStartedEvents: number;
  startedDidNotFinish: number;
  installViewedPeople: number;
  installCopiedPeople: number;
  surveyOpenedPeople: number;
  source: "live";
}

interface FunnelState {
  formStartedPeople: number;
  formStartedEvents: number;
  formCompletedPeople: number;
  installViewedPeople: number;
  installCopiedPeople: number;
  surveyOpenedPeople: number;
  startedKeys: string[];
  completedKeys: string[];
  viewedKeys: string[];
  copiedKeys: string[];
  surveyKeys: string[];
}

const KEY_CAP = 400;

const SEEDED: FunnelState = {
  formStartedPeople: 37,
  formStartedEvents: 42,
  formCompletedPeople: 2,
  installViewedPeople: 16,
  installCopiedPeople: 1,
  surveyOpenedPeople: 1,
  startedKeys: [],
  completedKeys: [],
  viewedKeys: [],
  copiedKeys: [],
  surveyKeys: [],
};

const localFile = path.join(process.cwd(), ".data", "growth-funnel.json");
const tmpFile = path.join("/tmp", "unvibe-growth-funnel", "growth-funnel.json");

export function parseFunnelTrackEvent(value: unknown): FunnelTrackEvent | null {
  if (typeof value !== "string") return null;
  return (FUNNEL_TRACK_EVENTS as readonly string[]).includes(value)
    ? (value as FunnelTrackEvent)
    : null;
}

function hashKey(distinctId: string): string {
  return createHash("sha256").update(distinctId.trim().slice(0, 80)).digest("hex").slice(0, 16);
}

function addUnique(keys: string[], key: string): { keys: string[]; added: boolean } {
  if (keys.includes(key)) return { keys, added: false };
  const next = [...keys, key];
  if (next.length > KEY_CAP) next.splice(0, next.length - KEY_CAP);
  return { keys: next, added: true };
}

function asState(raw: Partial<FunnelState> | null | undefined): FunnelState {
  return {
    formStartedPeople: Math.max(SEEDED.formStartedPeople, Number(raw?.formStartedPeople) || 0),
    formStartedEvents: Math.max(SEEDED.formStartedEvents, Number(raw?.formStartedEvents) || 0),
    formCompletedPeople: Math.max(SEEDED.formCompletedPeople, Number(raw?.formCompletedPeople) || 0),
    installViewedPeople: Math.max(SEEDED.installViewedPeople, Number(raw?.installViewedPeople) || 0),
    installCopiedPeople: Math.max(SEEDED.installCopiedPeople, Number(raw?.installCopiedPeople) || 0),
    surveyOpenedPeople: Math.max(SEEDED.surveyOpenedPeople, Number(raw?.surveyOpenedPeople) || 0),
    startedKeys: Array.isArray(raw?.startedKeys) ? raw.startedKeys.slice(-KEY_CAP) : [],
    completedKeys: Array.isArray(raw?.completedKeys) ? raw.completedKeys.slice(-KEY_CAP) : [],
    viewedKeys: Array.isArray(raw?.viewedKeys) ? raw.viewedKeys.slice(-KEY_CAP) : [],
    copiedKeys: Array.isArray(raw?.copiedKeys) ? raw.copiedKeys.slice(-KEY_CAP) : [],
    surveyKeys: Array.isArray(raw?.surveyKeys) ? raw.surveyKeys.slice(-KEY_CAP) : [],
  };
}

function applyEvent(state: FunnelState, event: FunnelTrackEvent, key: string): FunnelState {
  const next = { ...state };
  if (event === "waitlist_started") {
    next.formStartedEvents += 1;
    const unique = addUnique(next.startedKeys, key);
    next.startedKeys = unique.keys;
    if (unique.added) next.formStartedPeople += 1;
  } else if (event === "waitlist_completed") {
    const unique = addUnique(next.completedKeys, key);
    next.completedKeys = unique.keys;
    if (unique.added) next.formCompletedPeople += 1;
  } else if (event === "beta_install_viewed") {
    const unique = addUnique(next.viewedKeys, key);
    next.viewedKeys = unique.keys;
    if (unique.added) next.installViewedPeople += 1;
  } else if (event === "beta_install_copied") {
    const unique = addUnique(next.copiedKeys, key);
    next.copiedKeys = unique.keys;
    if (unique.added) next.installCopiedPeople += 1;
  } else {
    const unique = addUnique(next.surveyKeys, key);
    next.surveyKeys = unique.keys;
    if (unique.added) next.surveyOpenedPeople += 1;
  }
  return next;
}

function toFunnel(state: FunnelState): StoredGrowthFunnel {
  return {
    formStartedPeople: state.formStartedPeople,
    formStartedEvents: state.formStartedEvents,
    startedDidNotFinish: Math.max(0, state.formStartedPeople - state.formCompletedPeople),
    installViewedPeople: state.installViewedPeople,
    installCopiedPeople: state.installCopiedPeople,
    surveyOpenedPeople: state.surveyOpenedPeople,
    source: "live",
  };
}

async function dataPath(): Promise<string> {
  try {
    await fs.mkdir(path.dirname(localFile), { recursive: true });
    return localFile;
  } catch {
    await fs.mkdir(path.dirname(tmpFile), { recursive: true });
    return tmpFile;
  }
}

async function readLocal(): Promise<FunnelState> {
  try {
    const raw = JSON.parse(await fs.readFile(await dataPath(), "utf8")) as Partial<FunnelState>;
    return asState(raw);
  } catch {
    return asState(SEEDED);
  }
}

async function writeLocal(state: FunnelState): Promise<void> {
  const file = await dataPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(state), "utf8");
}

function supabaseReady(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

async function readSentinel(): Promise<FunnelState> {
  const entry = await findWaitlistEntry(GROWTH_FUNNEL_EMAIL);
  if (!entry?.message) return asState(SEEDED);
  try {
    return asState(JSON.parse(entry.message) as Partial<FunnelState>);
  } catch {
    return asState(SEEDED);
  }
}

async function writeSentinel(state: FunnelState): Promise<void> {
  const payload = JSON.stringify(state);
  const existing = await findWaitlistEntry(GROWTH_FUNNEL_EMAIL);
  if (!existing) {
    await saveWaitlistEntry({
      firstName: "System",
      lastName: "Funnel",
      email: GROWTH_FUNNEL_EMAIL,
      referralCode: "funnel00",
      message: payload,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  const updated = await updateWaitlistDetails(GROWTH_FUNNEL_EMAIL, { message: payload });
  if (!updated) throw new Error("Growth funnel sentinel update failed");
}

export async function recordGrowthFunnelEvent(
  event: FunnelTrackEvent,
  distinctId: string,
): Promise<StoredGrowthFunnel> {
  const key = hashKey(distinctId || "anon");
  if (supabaseReady()) {
    try {
      const next = applyEvent(await readSentinel(), event, key);
      await writeSentinel(next);
      return toFunnel(next);
    } catch (error) {
      console.error("growth funnel sentinel write failed", error);
    }
  }
  const next = applyEvent(await readLocal(), event, key);
  await writeLocal(next);
  return toFunnel(next);
}

export async function getStoredGrowthFunnel(): Promise<StoredGrowthFunnel> {
  if (supabaseReady()) {
    try {
      return toFunnel(await readSentinel());
    } catch (error) {
      console.error("growth funnel sentinel read failed", error);
    }
  }
  return toFunnel(await readLocal());
}
