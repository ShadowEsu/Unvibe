export const BUILD_ROADMAP = [
  { label: "Idea", percent: 8, complete: true },
  { label: "MVP", percent: 22, complete: true },
  { label: "Private beta", percent: 38, complete: true },
  { label: "Feedback", percent: 55, complete: true },
  { label: "Live testing", percent: 68, complete: true },
  { label: "Public beta", percent: 82, complete: false, current: true },
  { label: "App Store", percent: 100, complete: false },
] as const;

export const BUILD_FOCUS_OPTIONS = [
  "Live testing",
  "Selection shortcut",
  "Island",
  "AI / API",
  "Settings",
  "Study / quiz",
  "Website",
  "Beta feedback",
  "Shipping",
] as const;

export interface BuildStatus {
  version: 1;
  roadmapPercent: number;
  totalSeconds: number;
  todaySeconds: number;
  todayKey: string;
  isBuilding: boolean;
  focus: string;
  note: string;
  sessionStartedAt: string | null;
  lastHeartbeatAt: string | null;
  updatedAt: string;
}

export type BuildAction =
  | { action: "start"; focus?: string; note?: string }
  | { action: "heartbeat" }
  | { action: "stop" }
  | { action: "update"; focus: string; note: string }
  | { action: "set-total"; totalHours: number };

const INITIAL_HOURS = 20 * 8;
const INITIAL_UPDATED_AT = "2026-07-29T12:00:00.000Z";
const PERTH_TZ = "Australia/Perth";
const MAX_HEARTBEAT_SECONDS = 90;

export function buildDayKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function defaultBuildStatus(now = new Date()): BuildStatus {
  return {
    version: 1,
    roadmapPercent: 75,
    totalSeconds: INITIAL_HOURS * 60 * 60,
    todaySeconds: 0,
    todayKey: buildDayKey(now),
    isBuilding: false,
    focus: "Closing in on public release",
    note: "Live testing and feedback are done. Public beta is next.",
    sessionStartedAt: null,
    lastHeartbeatAt: null,
    updatedAt: INITIAL_UPDATED_AT,
  };
}

export function normalizeBuildStatus(input: Partial<BuildStatus> | null | undefined, now = new Date()): BuildStatus {
  const fallback = defaultBuildStatus(now);
  const today = buildDayKey(now);
  return {
    version: 1,
    roadmapPercent: clamp(Math.max(75, finiteNumber(input?.roadmapPercent, fallback.roadmapPercent)), 0, 100),
    totalSeconds: Math.max(0, finiteNumber(input?.totalSeconds, fallback.totalSeconds)),
    todaySeconds: input?.todayKey === today ? Math.max(0, Number(input.todaySeconds) || 0) : 0,
    todayKey: today,
    isBuilding: Boolean(input?.isBuilding),
    focus: cleanText(input?.focus, 80) || fallback.focus,
    note: cleanText(input?.note, 220) || fallback.note,
    sessionStartedAt: validDate(input?.sessionStartedAt),
    lastHeartbeatAt: validDate(input?.lastHeartbeatAt),
    updatedAt: validDate(input?.updatedAt) ?? now.toISOString(),
  };
}

export function applyBuildAction(status: BuildStatus, action: BuildAction, now = new Date()): BuildStatus {
  const next = normalizeBuildStatus(status, now);
  creditElapsed(next, now);

  if (action.action === "start") {
    if (!next.isBuilding) next.sessionStartedAt = now.toISOString();
    next.isBuilding = true;
    next.lastHeartbeatAt = now.toISOString();
    if (action.focus) next.focus = cleanText(action.focus, 80) || next.focus;
    if (action.note !== undefined) next.note = cleanText(action.note, 220);
  }

  if (action.action === "heartbeat" && next.isBuilding) {
    next.lastHeartbeatAt = now.toISOString();
  }

  if (action.action === "stop") {
    next.isBuilding = false;
    next.sessionStartedAt = null;
    next.lastHeartbeatAt = now.toISOString();
  }

  if (action.action === "update") {
    next.focus = cleanText(action.focus, 80) || next.focus;
    next.note = cleanText(action.note, 220);
  }

  if (action.action === "set-total") {
    next.totalSeconds = clamp(Math.round(action.totalHours * 3600), 0, 100_000 * 3600);
  }

  next.updatedAt = now.toISOString();
  return next;
}

export function publicBuildStatus(status: BuildStatus, now = new Date()) {
  const live = status.isBuilding;
  const sessionSeconds = live && status.sessionStartedAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(status.sessionStartedAt).getTime()) / 1000))
    : 0;
  return { ...status, isLive: live, sessionSeconds };
}

function creditElapsed(status: BuildStatus, now: Date): void {
  if (!status.isBuilding || !status.lastHeartbeatAt) return;
  const elapsed = Math.floor((now.getTime() - new Date(status.lastHeartbeatAt).getTime()) / 1000);
  const credit = clamp(elapsed, 0, MAX_HEARTBEAT_SECONDS);
  status.totalSeconds += credit;
  status.todaySeconds += credit;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
