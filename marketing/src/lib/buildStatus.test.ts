import assert from "node:assert/strict";
import test from "node:test";
import { applyBuildAction, defaultBuildStatus, publicBuildStatus } from "@/lib/buildStatus";

test("build timer starts, credits bounded heartbeats, and stops", () => {
  const start = new Date("2026-07-29T10:00:00.000Z");
  let status = applyBuildAction(defaultBuildStatus(start), { action: "start", focus: "Island", note: "Smoothing motion" }, start);
  assert.equal(status.isBuilding, true);
  assert.equal(status.focus, "Island");

  status = applyBuildAction(status, { action: "heartbeat" }, new Date("2026-07-29T10:00:30.000Z"));
  assert.equal(status.totalSeconds, (20 * 8 * 3600) + 30);

  status = applyBuildAction(status, { action: "heartbeat" }, new Date("2026-07-29T10:05:00.000Z"));
  assert.equal(status.totalSeconds, (20 * 8 * 3600) + 120);

  status = applyBuildAction(status, { action: "stop" }, new Date("2026-07-29T10:05:15.000Z"));
  assert.equal(status.isBuilding, false);
  assert.equal(status.sessionStartedAt, null);
});

test("public status stays live until the founder stops the session", () => {
  const start = new Date("2026-07-29T10:00:00.000Z");
  const status = applyBuildAction(defaultBuildStatus(start), { action: "start" }, start);
  const oneMinuteLater = publicBuildStatus(status, new Date("2026-07-29T10:01:00.000Z"));
  assert.equal(oneMinuteLater.isLive, true);
  assert.equal(oneMinuteLater.displayTotalSeconds, (20 * 8 * 3600) + 60);
  assert.equal(oneMinuteLater.displayTodaySeconds, 60);
  assert.equal(publicBuildStatus(status, new Date("2026-07-29T10:03:00.000Z")).isLive, true);
});
