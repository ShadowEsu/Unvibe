import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compensationCashUsd,
  compensationCreditsUsd,
  compensationLines,
  compensationTotalLabel,
  compensationTotalUsd,
} from "./compensation";

describe("compensation", () => {
  it("includes Mixpanel Pro at 144000 and sums every line", () => {
    const mixpanel = compensationLines.find((line) => line.name.startsWith("Mixpanel"));
    assert.equal(mixpanel?.amountUsd, 144_000);
    assert.match(mixpanel?.detail ?? "", /1 year/i);
    assert.equal(compensationTotalUsd(), compensationCreditsUsd() + compensationCashUsd());
    assert.equal(compensationTotalUsd(), 231_700);
    assert.equal(compensationTotalLabel(), "$231,700");
  });
});
