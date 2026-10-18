import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signEmail } from "./rewardLink";
import { suppressionKey, unsubscribeHeaders, unsubscribeUrl, verifyUnsubscribeToken, withoutUnsubscribed } from "./unsubscribe";
import { GET, POST } from "../app/api/unsubscribe/route";
import { isEmailUnsubscribed } from "./waitlistStore";

process.env.REWARD_LINK_SECRET = "test-secret";
process.env.NEXT_PUBLIC_SITE_URL = "https://unvibe.site";

function tokenFrom(url: string): string {
  return new URL(url).searchParams.get("t") ?? "";
}

describe("unsubscribe tokens", () => {
  it("verifies the signed address, case insensitive", () => {
    const url = unsubscribeUrl("Friend@Example.com");
    assert.equal(new URL(url).searchParams.get("e"), "friend@example.com");
    assert.equal(verifyUnsubscribeToken("friend@example.com", tokenFrom(url)), true);
    assert.equal(verifyUnsubscribeToken("FRIEND@example.com", tokenFrom(url)), true);
  });

  it("rejects a tampered token", () => {
    const token = tokenFrom(unsubscribeUrl("friend@example.com"));
    const flipped = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
    assert.equal(verifyUnsubscribeToken("friend@example.com", flipped), false);
    assert.equal(verifyUnsubscribeToken("friend@example.com", ""), false);
    assert.equal(verifyUnsubscribeToken("friend@example.com", "not-a-token"), false);
  });

  it("rejects another address and a feedback link token", () => {
    const token = tokenFrom(unsubscribeUrl("friend@example.com"));
    assert.equal(verifyUnsubscribeToken("someone@else.com", token), false);
    assert.equal(verifyUnsubscribeToken("friend@example.com", signEmail("friend@example.com")), false);
  });

  it("builds RFC 8058 one-click headers for the same link", () => {
    const headers = unsubscribeHeaders("friend@example.com");
    assert.equal(headers["List-Unsubscribe"], `<${unsubscribeUrl("friend@example.com")}>`);
    assert.match(headers["List-Unsubscribe"], /^<https:\/\/unvibe\.site\/api\/unsubscribe\?e=friend%40example\.com&t=[a-f0-9]{32}>$/);
    assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  });
});

describe("send decision", () => {
  it("skips an unsubscribed address, whatever its case, and keeps everyone else", () => {
    const unsubscribed = new Set([suppressionKey("b@example.com")]);
    const entries = [{ email: "a@example.com" }, { email: " B@Example.com " }, { email: "c@example.com" }];
    assert.deepEqual(withoutUnsubscribed(entries, unsubscribed).map((entry) => entry.email), ["a@example.com", "c@example.com"]);
  });

  it("keys suppression by a hash, never the plaintext address", () => {
    const key = suppressionKey("Friend@Example.com");
    assert.match(key, /^[a-f0-9]{64}$/);
    assert.equal(key, suppressionKey("friend@example.com"));
    assert.notEqual(key, "friend@example.com");
  });
});

describe("unsubscribe route", () => {
  it("GET only asks: a button that POSTs the same signed link", async () => {
    const link = unsubscribeUrl("friend@example.com");
    const response = await GET(new Request(link));
    assert.equal(response.status, 200);
    const html = await response.text();
    const action = `${new URL(link).pathname}${new URL(link).search}`.replace(/&/g, "&amp;");
    assert.ok(html.includes(`<form method="post" action="${action}"`));
    assert.match(html, />Unsubscribe<\/button>/);
    assert.doesNotMatch(html, /You're unsubscribed/);
    // No Supabase env in this file, so this reads the local fallback: GET wrote nothing.
    assert.equal(await isEmailUnsubscribed("friend@example.com"), false);
  });

  it("rejects a bad token on GET and POST without recording", async () => {
    const link = new URL(unsubscribeUrl("friend@example.com"));
    link.searchParams.set("e", "someone@else.com");
    assert.equal((await GET(new Request(link))).status, 400);
    const post = await POST(new Request(link, { method: "POST", body: "List-Unsubscribe=One-Click" }));
    assert.equal(post.status, 400);
    assert.match(await post.text(), /This link does not work/);
  });
});
