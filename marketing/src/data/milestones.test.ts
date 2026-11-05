import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { changelogAnchors, changelogArchive, changelogEntries, milestones } from "./milestones";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

describe("milestones", () => {
  it("are dated DD MON YYYY and listed newest first, as /releases shows them", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const { date, title } of milestones) {
      const match = /^(\d{1,2}) ([A-Z]{3}) (\d{4})$/.exec(date);
      assert.ok(match && MONTHS.includes(match[2]!), `${title}: bad date ${date}`);
      const time = Date.UTC(Number(match[3]), MONTHS.indexOf(match[2]!), Number(match[1]));
      assert.ok(time <= previous, `${title} (${date}) is newer than the entry above it`);
      previous = time;
    }
  });

  it("fold on /releases without losing or reordering an entry, one group per month", () => {
    const entries = changelogEntries();
    const { recent, months } = changelogArchive(entries, 12);
    assert.equal(recent.length, 12);
    assert.deepEqual([...recent, ...months.flatMap((month) => month.items)], entries);
    assert.equal(new Set(months.map((month) => month.label)).size, months.length, "a month appears twice");
    for (const month of months) {
      for (const item of month.items) assert.ok(month.label.endsWith(item.date.slice(-4)), `${item.title} under ${month.label}`);
      assert.match(month.label, /^[A-Z][a-z]+ \d{4}$/);
    }
    assert.deepEqual(changelogArchive(entries.slice(0, 3), 12), { recent: entries.slice(0, 3), months: [] });
  });

  it("each get a unique /releases anchor; a version's first entry is reachable as #v0-1-<n>", () => {
    const entries = changelogEntries();
    const anchors = changelogAnchors(entries);
    assert.equal(new Set(anchors).size, entries.length, "two entries share an anchor");
    for (const anchor of anchors) assert.match(anchor, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    const firstOf = new Map<string, string>();
    entries.forEach((item, index) => {
      const version = item.figure?.match(/^v\d+(?:\.\d+)*/)?.[0];
      if (version && !firstOf.has(version)) firstOf.set(version, anchors[index]!);
    });
    firstOf.forEach((anchor, version) => assert.equal(anchor, version.replace(/\./g, "-")));
    assert.deepEqual(
      changelogAnchors([
        { ...entries[0]!, figure: "v1.0", title: "A" },
        { ...entries[0]!, figure: "v1.0", title: "B" },
        { ...entries[0]!, figure: undefined, title: "Hello, World!" },
      ]),
      ["v1-0", "v1-0-2", "hello-world"],
    );
  });
});
