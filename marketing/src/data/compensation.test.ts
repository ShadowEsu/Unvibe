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
    const salesforce = compensationLines.find((line) => line.name.startsWith("Salesforce"));
    assert.equal(salesforce?.amountUsd, 13_500);
    assert.match(salesforce?.detail ?? "", /30 Starter Suite seats/i);
    const explicitSum = compensationLines.reduce((sum, line) => sum + line.amountUsd, 0);
    assert.equal(explicitSum, 267_700);
    assert.equal(compensationTotalUsd(), compensationCreditsUsd() + compensationCashUsd());
    assert.equal(compensationTotalUsd(), 267_700);
    assert.equal(compensationCreditsUsd(), 266_900);
    assert.equal(compensationCashUsd(), 800);
    assert.equal(compensationTotalLabel(), "$267,700");
    const claude = compensationLines.find((line) => line.name === "Claude for Startups");
    assert.equal(claude?.amountUsd, 21_500);
    const deepgram = compensationLines.find((line) => line.name.startsWith("Deepgram"));
    assert.equal(deepgram?.amountUsd, 1_000);
  });
});
