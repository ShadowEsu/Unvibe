import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compensationLines,
  compensationTotalLabel,
  compensationTotalUsd,
} from "./compensation";

describe("compensation", () => {
  it("sums the public self-reported cash lines", () => {
    assert.equal(compensationLines.length, 2);
    assert.ok(compensationLines.every((line) => line.kind === "cash"));
    assert.equal(compensationLines.reduce((sum, line) => sum + line.amountUsd, 0), 800);
    assert.equal(compensationTotalUsd(), 800);
    assert.equal(compensationTotalLabel(), "$800");
  });

  it("never publishes programs without verified disclosure permission", () => {
    assert.equal(compensationLines.some((line) => /aws/i.test(`${line.name} ${line.detail}`)), false);
    const removedPrograms = /anthropic|claude|mixpanel|posthog|salesforce|gitlab|linear|google|openai|deepgram|mongodb/i;
    assert.equal(
      compensationLines.some((line) => removedPrograms.test(`${line.name} ${line.detail}`)),
      false,
    );
  });

  it("keeps removed program claims and sponsor assets off the public surfaces", () => {
    const membership = /(?:claude|mixpanel|posthog|salesforce|gitlab|openai|deepgram|mongodb) for startups|salesforce launchpad|linear founder value pack|google ai startups|(?:aws|google cloud) credits/i;
    for (const file of [
      "src/components/paper/BackingStrip.tsx",
      "src/app/about/page.tsx",
      "src/app/investors/page.tsx",
      "src/lib/kit.ts",
      "src/data/milestones.ts",
    ]) {
      assert.doesNotMatch(readFileSync(join(process.cwd(), file), "utf8"), membership, file);
    }
    for (const name of ["aws", "deepgram", "gitlab", "googlecloud", "linear", "mixpanel", "mongodb", "openai", "posthog", "salesforce"]) {
      assert.equal(existsSync(join(process.cwd(), "public/sponsors", `${name}.svg`)), false, name);
    }
  });
});
