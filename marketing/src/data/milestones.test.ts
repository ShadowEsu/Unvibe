import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { changelogArchive, changelogEntries, milestones } from "./milestones";

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
});
