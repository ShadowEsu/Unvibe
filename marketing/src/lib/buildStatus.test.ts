import assert from "node:assert/strict";
import test from "node:test";
import { applyBuildAction, buildDayKey, defaultBuildStatus, INITIAL_SECONDS, normalizeBuildStatus, publicBuildStatus } from "@/lib/buildStatus";
import { dayKey } from "@/lib/siteStatsStore";

test("build timer starts, credits bounded heartbeats, and stops", () => {
  const start = new Date("2026-07-29T10:00:00.000Z");
  let status = applyBuildAction(defaultBuildStatus(start), { action: "start", focus: "Island", note: "Smoothing motion" }, start);
  assert.equal(status.isBuilding, true);
  assert.equal(status.focus, "Island");

  status = applyBuildAction(status, { action: "heartbeat" }, new Date("2026-07-29T10:00:30.000Z"));
  assert.equal(status.totalSeconds, INITIAL_SECONDS + 30);

  status = applyBuildAction(status, { action: "heartbeat" }, new Date("2026-07-29T10:05:00.000Z"));
  assert.equal(status.totalSeconds, INITIAL_SECONDS + 120);

  status = applyBuildAction(status, { action: "stop" }, new Date("2026-07-29T10:05:15.000Z"));
  assert.equal(status.isBuilding, false);
  assert.equal(status.sessionStartedAt, null);
});

test("public status stays live until the switch is turned off", () => {
  const start = new Date("2026-07-29T10:00:00.000Z");
  let status = applyBuildAction(defaultBuildStatus(start), { action: "start" }, start);
  assert.equal(publicBuildStatus(status, new Date("2026-07-29T10:01:00.000Z")).isLive, true);
  assert.equal(publicBuildStatus(status, new Date("2026-07-29T10:03:00.000Z")).isLive, true);
  status = applyBuildAction(status, { action: "stop" }, new Date("2026-07-29T10:03:00.000Z"));
  assert.equal(publicBuildStatus(status, new Date("2026-07-29T10:03:00.000Z")).isLive, false);
});

test("build timer starts at 162.56 hours and does not drop below that", () => {
  const fresh = defaultBuildStatus(new Date("2026-08-17T00:00:00.000Z"));
  assert.equal(fresh.totalSeconds, INITIAL_SECONDS);
  assert.equal((fresh.totalSeconds / 3600).toFixed(2), "162.56");

  const lifted = normalizeBuildStatus({ totalSeconds: 160 * 3600 }, new Date("2026-08-17T00:00:00.000Z"));
  assert.equal(lifted.totalSeconds, INITIAL_SECONDS);
});

test("set-clock writes hours and minutes without dropping below the floor", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");
  const raised = applyBuildAction(defaultBuildStatus(now), { action: "set-clock", hours: 170, minutes: 12 }, now);
  assert.equal(raised.totalSeconds, 170 * 3600 + 12 * 60);

  const floored = applyBuildAction(defaultBuildStatus(now), { action: "set-clock", hours: 10, minutes: 0 }, now);
  assert.equal(floored.totalSeconds, INITIAL_SECONDS);
});

test("the build day turns over at Pacific midnight, like the site's other day keys", () => {
  const cases: Array<[string, string]> = [
    ["2026-10-26T06:59:59.000Z", "2026-10-25"],
    ["2026-10-26T07:00:00.000Z", "2026-10-26"],
    ["2026-12-01T07:59:59.000Z", "2026-11-30"],
    ["2026-12-01T08:00:00.000Z", "2026-12-01"],
  ];
  for (const [iso, day] of cases) {
    assert.equal(buildDayKey(new Date(iso)), day, iso);
    assert.equal(buildDayKey(new Date(iso)), dayKey(new Date(iso)), iso);
  }

  const yesterday = { todayKey: "2026-10-25", todaySeconds: 100 };
  assert.equal(normalizeBuildStatus(yesterday, new Date("2026-10-26T06:59:59.000Z")).todaySeconds, 100);
  assert.equal(normalizeBuildStatus(yesterday, new Date("2026-10-26T07:00:00.000Z")).todaySeconds, 0);
});
