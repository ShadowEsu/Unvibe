import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InvestorsPage from "@/app/investors/page";
import { ChangelogList } from "@/components/paper/ChangelogList";
import { CountUp } from "@/components/paper/CountUp";
import { WhoItsForCards } from "@/components/paper/WhoItsFor";
import {
  ARRIVE_LIMIT,
  SKELETON_AFTER_MS,
  arrivingItems,
  countUpDuration,
  countUpFrame,
  stageArrival,
  tryWaitView,
} from "./motionMoments";

// tsx compiles JSX to React.createElement, so rendering components here needs React in scope.
Object.assign(globalThis, { React });

describe("Try it wait: the step line follows the request, not a clock", () => {
  it("shows one unchanging step for the whole wait, however long it runs", () => {
    // The old box rotated its notes every 1300 ms whatever the request was doing.
    const steps = [0, 199, 1300, 2600, 3900, 60_000].map((ms) => tryWaitView("thinking", ms).step);
    assert.ok(steps[0]);
    assert.equal(new Set(steps).size, 1, steps.join(" | "));
  });

  it("drops the step, the skeleton and aria-busy the moment the answer or an error arrives", () => {
    for (const phase of ["done", "error", "idle"] as const) {
      for (const ms of [0, SKELETON_AFTER_MS, 60_000]) {
        assert.deepEqual(tryWaitView(phase, ms), { step: null, skeleton: false, busy: false }, `${phase} at ${ms}`);
      }
    }
  });

  it("keeps the shimmer off for a fast answer and on once the wait passes 200 ms", () => {
    assert.equal(SKELETON_AFTER_MS, 200);
    assert.equal(tryWaitView("thinking", 0).skeleton, false);
    assert.equal(tryWaitView("thinking", 199).skeleton, false);
    assert.equal(tryWaitView("thinking", 200).skeleton, true);
    assert.equal(tryWaitView("thinking", 0).busy, true);
  });
});

describe("count-up", () => {
  it("lasts 700 ms under 100, 1000 ms under 10,000 and never more than 1200 ms", () => {
    assert.deepEqual([0, 7, 99].map(countUpDuration), [700, 700, 700]);
    assert.deepEqual([100, 9_999].map(countUpDuration), [1000, 1000]);
    assert.deepEqual([10_000, 5_000_000].map(countUpDuration), [1200, 1200]);
  });

  it("starts at the start, ends exactly on the real number, and never overshoots or runs backwards", () => {
    for (const to of [1, 7, 42, 99, 100, 4_321, 12_345]) {
      const duration = countUpDuration(to);
      assert.equal(countUpFrame(0, to, 0), 0, `${to} at 0`);
      assert.equal(countUpFrame(0, to, duration), to, `${to} at the end`);
      assert.equal(countUpFrame(0, to, duration + 500), to, `${to} after the end`);
      let last = 0;
      for (let ms = 0; ms <= duration; ms += 4) {
        const n = countUpFrame(0, to, ms);
        assert.ok(n >= last && n <= to, `${to} at ${ms} ms showed ${n} after ${last}`);
        last = n;
      }
    }
  });

  it("eases out: past halfway by half time (--m-ease-smooth front-loads the count)", () => {
    assert.ok(countUpFrame(0, 1000, 500) > 500, String(countUpFrame(0, 1000, 500)));
  });

  it("server HTML shows the final value, and the aria-label says it, with the moving digits hidden", () => {
    const html = renderToStaticMarkup(createElement(CountUp, { name: "test-a", value: 12_345, suffix: "+" }));
    assert.match(html, /aria-label="12,345\+"/);
    assert.match(html, /<span aria-hidden="true">12,345\+<\/span>/);
    assert.match(html, /data-tabular=""/);
    const arrived = renderToStaticMarkup(createElement(CountUp, { name: "test-b", value: 3, arrived: true }));
    assert.match(arrived, /aria-label="3"><span aria-hidden="true">3<\/span>/);
  });

  it("/investors renders its real releases count, not 0, in both the label and the digits", () => {
    const page = renderToStaticMarkup(createElement(InvestorsPage));
    const stat = page.match(/aria-label="(\d+)\+"><span aria-hidden="true">(\d+)\+<\/span>/);
    assert.ok(stat, "the releases count-up is missing");
    assert.equal(stat[1], stat[2]);
    assert.ok(Number(stat[1]) > 0);
  });
});

describe("staggered arrival", () => {
  it("animates only the first 8 items; the rest are just there", () => {
    assert.equal(ARRIVE_LIMIT, 8);
    assert.deepEqual(arrivingItems(20), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(arrivingItems(3), [0, 1, 2]);
    assert.deepEqual(arrivingItems(0), []);
  });

  it("hides nothing that is already on screen, and nothing under reduced motion or without an observer", () => {
    const below = { reducedMotion: false, hasObserver: true, top: 1200, viewportHeight: 800 };
    assert.equal(stageArrival(below), true);
    assert.equal(stageArrival({ ...below, top: 800 }), true);
    assert.equal(stageArrival({ ...below, top: 799 }), false, "a list peeking above the fold would flash out");
    assert.equal(stageArrival({ ...below, top: -300 }), false);
    assert.equal(stageArrival({ ...below, reducedMotion: true }), false);
    assert.equal(stageArrival({ ...below, hasObserver: false }), false, "without an observer nothing would reveal it");
  });

  it("server HTML carries no start state: every card and release entry is visible without JS", () => {
    for (const html of [
      renderToStaticMarkup(createElement(WhoItsForCards)),
      renderToStaticMarkup(createElement(ChangelogList, { arrive: true })),
    ]) {
      assert.match(html, /<article/);
      assert.doesNotMatch(html, /data-arrive|style=|opacity/);
    }
  });
});
