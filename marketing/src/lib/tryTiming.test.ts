import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerTimeLine } from "./tryTiming";

describe("the line under a finished Try it answer", () => {
  it("says the measured time to one decimal", () => {
    assert.equal(answerTimeLine(2412), "That took 2.4 seconds. Do it on your own code:");
    assert.equal(answerTimeLine(2450), "That took 2.5 seconds. Do it on your own code:");
    assert.equal(answerTimeLine(10_049), "That took 10.0 seconds. Do it on your own code:");
  });

  it("never rounds a real run down to zero", () => {
    assert.equal(answerTimeLine(30), "That took 0.1 seconds. Do it on your own code:");
  });

  it("shows nothing without a usable measurement", () => {
    for (const ms of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(answerTimeLine(ms), null, String(ms));
  });
});
