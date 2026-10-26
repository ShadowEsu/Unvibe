import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { statsKeyMatches } from "./privateStats";

const KEY = "fixture-stats-key-0001"; // a fixture, longer than the 16 characters the page requires

describe("the private stats page opens only for its exact key", () => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.STATS_PAGE_KEY;
    process.env.STATS_PAGE_KEY = KEY;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.STATS_PAGE_KEY;
    else process.env.STATS_PAGE_KEY = previous;
  });

  it("accepts the key and refuses a same-length wrong one", () => {
    assert.equal(statsKeyMatches(KEY), true);
    assert.equal(statsKeyMatches(`${KEY.slice(0, -1)}X`), false);
  });

  it("refuses a guess with as many characters but non-ASCII bytes, without throwing", () => {
    const guess = `é${KEY.slice(1)}`; // 16 characters, 17 bytes
    assert.equal(guess.length, KEY.length);
    assert.equal(statsKeyMatches(guess), false);
  });

  it("stays closed when the configured key is too short", () => {
    process.env.STATS_PAGE_KEY = "short-key";
    assert.equal(statsKeyMatches("short-key"), false);
  });
});
