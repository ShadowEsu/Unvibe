import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COURTS, GOOGLE_SHARE, INCIDENTS, PROBLEM_STATS, RESEARCH, formatStat, verdictCounts, type Source } from "./problem";

const allSources: Source[] = [
  ...PROBLEM_STATS.flatMap((stat) => stat.sources),
  ...INCIDENTS.flatMap((incident) => incident.sources),
  ...RESEARCH.flatMap((row) => row.sources),
  ...GOOGLE_SHARE.sources,
];

describe("the problem data matches the founder's note", () => {
  it("prints the four headline numbers exactly as the note does", () => {
    assert.deepEqual(PROBLEM_STATS.map((stat) => formatStat(stat, stat.value)), ["45%", "5,000+", "75%", "$4.99M"]);
  });

  it("counts up from zero in the same format", () => {
    assert.deepEqual(PROBLEM_STATS.map((stat) => formatStat(stat, 0)), ["0%", "0+", "0%", "$0.00M"]);
  });

  it("scores the fourteen incidents 6 · 4 · 4", () => {
    assert.equal(INCIDENTS.length, 14);
    assert.deepEqual(verdictCounts(), { direct: 6, partial: 4, out: 4 });
  });

  it("keeps the note's hedges on disputed accounts", () => {
    const what = (who: string) => INCIDENTS.find((incident) => incident.who === who)?.what ?? "";
    assert.match(what("Amazon retail"), /none involved AI-written code/);
    assert.match(what("Bootlegger Coffee"), /disputes that customer data was involved/);
    assert.match(what("Tea app"), /Lawyers allege/);
  });

  it("keeps the research table's six figures", () => {
    assert.deepEqual(RESEARCH.map((row) => row.number), ["45%", "~1.7\u00D7", "19% slower", "6 \u2192 35", "46% vs. 33%", "66%"]);
    assert.deepEqual(COURTS.exposure.map((row) => row.figure), ["$100\u2013$750", "$5,000", "$3.85M"]);
  });

  it("names a source for every number, and links only over https", () => {
    for (const stat of PROBLEM_STATS) assert.ok(stat.sources.length > 0, stat.label);
    for (const incident of INCIDENTS) assert.ok(incident.sources.length > 0, incident.who);
    for (const row of RESEARCH) assert.ok(row.sources.length > 0, row.finding);
    for (const source of allSources) {
      assert.ok(source.name.trim().length > 0);
      if (source.href) assert.match(source.href, /^https:\/\//, source.name);
    }
  });
});
