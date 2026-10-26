import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sitemap from "../app/sitemap";
import {
  clearPromoCode,
  formatCodeInput,
  formatProUntil,
  normalisePromoCode,
  pendingPromoCode,
  redeemOutcome,
  savePromoCode,
} from "./promoRedeem";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const TZ = "America/Los_Angeles";

describe("promo code input on /redeem", () => {
  it("normalises like the API: case, spaces, hyphens, O→0, I and L→1", () => {
    assert.equal(normalisePromoCode("abcd-efgh-jkmn-pqrs"), "ABCDEFGHJKMNPQRS");
    assert.equal(normalisePromoCode(" o1i2 l3o4-5678-9ABC "), "01121304" + "56789ABC");
    for (const bad of ["", "ABCD-EFGH-JKMN", "ABCD-EFGH-JKMN-PQRU", "ABCD_EFGH_JKMN_PQRS", "ABCD-EFGH-JKMN-PQRS-T"]) {
      assert.equal(normalisePromoCode(bad), null, bad);
    }
  });

  it("formats while typing: upper case, groups of four, at most 16 characters", () => {
    assert.equal(formatCodeInput("abcde"), "ABCD-E");
    assert.equal(formatCodeInput("ABCD-"), "ABCD");
    assert.equal(formatCodeInput("abcd efgh jkmn pqrs extra"), "ABCD-EFGH-JKMN-PQRS");
    assert.equal(formatCodeInput("ab!cd--ef"), "ABCD-EF");
    assert.equal(formatCodeInput(""), "");
  });
});

describe("the code across the sign-in redirect", () => {
  it("takes a promo code from ?promo=, keeps it, and clears it from the address bar", () => {
    const storage = memoryStorage();
    assert.deepEqual(pendingPromoCode("?promo=abcd-efgh-jkmn-pqrs&utm_source=calhacks", storage), {
      code: "ABCD-EFGH-JKMN-PQRS", authCode: null, cleanSearch: "?utm_source=calhacks",
    });
    assert.equal(storage.items.get("unvibe_promo_code"), "ABCDEFGHJKMNPQRS");
  });

  it("?code= is only ever the sign-in code, even when it looks like a promo code", () => {
    const storage = memoryStorage();
    assert.deepEqual(pendingPromoCode("?code=ABCD-EFGH-JKMN-PQRS", storage), { code: "", authCode: "ABCD-EFGH-JKMN-PQRS", cleanSearch: "" });
    assert.equal(storage.items.size, 0, "nothing from ?code= is kept as a promo code");
  });

  it("after the sign-in redirect, exchanges ?code= and restores the saved promo code", () => {
    const storage = memoryStorage();
    pendingPromoCode("?promo=abcd efgh jkmn pqrs", storage);
    const oauth = "6b2f8a62-9c47-4e0e-8d0e-2f2d7f6a9c11";
    assert.deepEqual(pendingPromoCode(`?code=${oauth}`, storage), { code: "ABCD-EFGH-JKMN-PQRS", authCode: oauth, cleanSearch: "" });
  });

  it("shows a malformed ?promo= so it can be fixed, without keeping it", () => {
    const storage = memoryStorage();
    assert.deepEqual(pendingPromoCode("?promo=abcd-efgh", storage), { code: "ABCD-EFGH", authCode: null, cleanSearch: "" });
    assert.equal(storage.items.size, 0);
  });

  it("leaves the URL alone without ?promo= or ?code= and forgets the code when told to", () => {
    const storage = memoryStorage();
    savePromoCode("ABCD-EFGH-JKMN-PQRS", storage);
    assert.deepEqual(pendingPromoCode("?utm_source=x", storage), { code: "ABCD-EFGH-JKMN-PQRS", authCode: null, cleanSearch: null });
    clearPromoCode(storage);
    assert.deepEqual(pendingPromoCode("", storage), { code: "", authCode: null, cleanSearch: null });
    savePromoCode("not a code", storage);
    assert.equal(storage.items.size, 0);
  });

  it("works with storage blocked", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    assert.deepEqual(pendingPromoCode("?promo=ABCD-EFGH-JKMN-PQRS", blocked), { code: "ABCD-EFGH-JKMN-PQRS", authCode: null, cleanSearch: "" });
    assert.doesNotThrow(() => clearPromoCode(blocked));
  });
});

describe("one line per answer", () => {
  const until = "2027-01-24T20:00:00.000Z";

  it("redeemed: the months and the real end date from the server, then the download", () => {
    const outcome = redeemOutcome(200, { ok: true, status: "redeemed", months: 3, proUntil: until }, TZ);
    assert.deepEqual(outcome, { kind: "redeemed", ok: true, line: "3 months of Pro added. Pro until January 24, 2027.", showDownload: true, final: true });
    assert.equal(redeemOutcome(200, { status: "redeemed", months: 1, proUntil: until }, TZ).line, "1 month of Pro added. Pro until January 24, 2027.");
    assert.equal(redeemOutcome(200, { status: "redeemed", months: 3, proUntil: "not a date" }, TZ).line, "3 months of Pro added.");
  });

  it("already_yours: says so with the date, then the download", () => {
    const outcome = redeemOutcome(200, { ok: true, status: "already_yours", months: 3, proUntil: until }, TZ);
    assert.equal(outcome.line, "This code is already on your account. Pro until January 24, 2027.");
    assert.equal(outcome.showDownload, true);
  });

  it("every refusal has its own line and no download", () => {
    const cases: Array<[number, string, string, boolean]> = [
      [400, "bad_code", "That code does not look right. Codes have 16 letters and numbers, like ABCD-EFGH-JKMN-PQRS.", false],
      [404, "invalid", "That code was not found. Check it and try again.", true],
      [409, "used", "That code has already been used by another account.", true],
      [409, "one_per_account", "This account already used a code from this offer.", true],
      [409, "has_paid_plan", "You already have a paid plan, so the code was not used.", true],
      [410, "expired", "That code has expired.", true],
      [410, "cap_reached", "Every code from this offer has been claimed.", true],
      [429, "rate_limited", "Too many tries. Wait a minute and try again.", false],
      [503, "unavailable", "Codes cannot be redeemed right now. Try again shortly.", false],
    ];
    const lines = new Set<string>();
    for (const [http, error, line, final] of cases) {
      const outcome = redeemOutcome(http, { ok: false, error, message: "server text is not shown" });
      assert.deepEqual(outcome, { kind: error, ok: false, line, showDownload: false, final }, error);
      lines.add(outcome.line);
    }
    assert.equal(lines.size, cases.length, "no two answers share a line");
  });

  it("falls back on the HTTP status for the API's 401 and the proxy's own answers", () => {
    assert.equal(redeemOutcome(401, { ok: false, error: "unauthorized" }).kind, "signed_out");
    assert.equal(redeemOutcome(429, { error: "Too many tries. Wait a minute and try again." }).kind, "rate_limited");
    assert.equal(redeemOutcome(403, { error: "This form only works on unvibe.site." }).kind, "unavailable");
    assert.equal(redeemOutcome(502, null).kind, "unavailable");
    assert.equal(redeemOutcome(200, { status: "something_new" }).kind, "unavailable");
  });

  it("writes no em dashes and uses sentence case", () => {
    const all = [
      "bad_code", "invalid", "used", "one_per_account", "has_paid_plan", "expired", "cap_reached", "rate_limited", "unavailable",
    ].map((error) => redeemOutcome(400, { error }).line);
    all.push(redeemOutcome(200, { status: "redeemed", months: 3, proUntil: until }, TZ).line);
    for (const line of all) {
      assert.ok(!line.includes("\u2014"), line);
      assert.match(line, /^[A-Z0-9]/);
    }
  });

  it("dates read in the reader's time zone", () => {
    assert.equal(formatProUntil("2026-12-01T07:59:59Z", TZ), "November 30, 2026");
    assert.equal(formatProUntil("2026-12-01T07:59:59Z", "UTC"), "December 1, 2026");
    assert.equal(formatProUntil("nope", TZ), null);
  });
});

describe("/redeem stays out of search", () => {
  it("is not in the sitemap", () => {
    assert.ok(sitemap().every((entry) => !entry.url.includes("/redeem")));
  });
});
