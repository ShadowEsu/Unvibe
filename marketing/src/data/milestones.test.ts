import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { milestones } from "./milestones";

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
});
