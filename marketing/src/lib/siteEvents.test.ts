// First import: unsets the analytics keys before analytics.ts reads them at load.
import { restoreAnalyticsKeys } from "./testWithoutAnalyticsKeys";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { trackDownloadClick, trackDownloadPageClick, trackReleaseDownload } from "./downloadTracking";
import {
  FIRST_TOUCH_KEY,
  FIRST_TOUCH_MAX_AGE_MS,
  normalizeUtmCampaign,
  normalizeUtmSource,
  parseSiteCount,
  parseVisitSource,
  rememberFirstTouch,
} from "./siteEvents";
import type { OptOutStorage } from "./trackingOptOut";
import { CHANNEL_DAY_KEY, sendVisitHit } from "./visitHit";

after(restoreAnalyticsKeys);

interface Request {
  url: string;
  body: unknown;
}

function fakeStorage(entries: Record<string, string> = {}): OptOutStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

let requests: Request[] = [];
const realWindow: unknown = Reflect.get(globalThis, "window");
const realFetch = globalThis.fetch;

function installWindow({
  pathname = "/",
  search = "",
  webdriver = false,
  storage = fakeStorage(),
}: { pathname?: string; search?: string; webdriver?: boolean; storage?: OptOutStorage } = {}): void {
  Reflect.set(globalThis, "window", {
    navigator: { webdriver },
    location: { href: `https://unvibe.site${pathname}${search}`, host: "unvibe.site", pathname, search },
    localStorage: storage,
    dispatchEvent: () => true,
  });
}

/** Bodies sent to one first-party endpoint. */
function sentTo(url: string): unknown[] {
  return requests.filter((request) => request.url === url).map((request) => request.body);
}

beforeEach(() => {
  requests = [];
  const recordingFetch: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(null, { status: 204 });
  };
  globalThis.fetch = recordingFetch;
  installWindow();
});

afterEach(() => {
  Reflect.set(globalThis, "window", realWindow);
  globalThis.fetch = realFetch;
});

describe("utm allow-list", () => {
  it("keeps dictionary values, lowercased and trimmed", () => {
    assert.equal(normalizeUtmSource(" Instagram "), "instagram");
    assert.equal(normalizeUtmSource("sideprojectors"), "sideprojectors");
    assert.equal(normalizeUtmCampaign("PROFILE"), "profile");
    assert.equal(normalizeUtmCampaign("carousel-ai-wrote-this"), "carousel-ai-wrote-this");
    assert.equal(normalizeUtmCampaign("x-p03"), "x-p03");
    assert.equal(normalizeUtmCampaign("short-y2"), "short-y2");
  });

  it("turns anything else into other, and no tag into direct / none", () => {
    for (const value of ["newsletter", "ab12cd34", "203.0.113.9", "__proto__", "constructor", "x-p0", "tiktok".repeat(8)]) {
      assert.equal(normalizeUtmSource(value), "other", value);
    }
    assert.equal(normalizeUtmCampaign(`carousel-${"a".repeat(40)}`), "other");
    assert.equal(normalizeUtmCampaign("launch"), "other");
    assert.equal(normalizeUtmCampaign("x-p0 ; drop table"), "other");
    assert.equal(normalizeUtmSource(""), "direct");
    assert.equal(normalizeUtmSource(undefined), "direct");
    assert.equal(normalizeUtmCampaign("  "), "none");
    assert.deepEqual(parseVisitSource({ source: "TikTok", campaign: "", ref: "ab12cd34" }), { event: "visit_source", dim1: "tiktok", dim2: "none" });
    assert.equal(parseVisitSource(undefined), null);
  });

  it("allows only the two download events, with known surfaces and platforms", () => {
    assert.deepEqual(parseSiteCount({ event: "release_download_clicked", surface: "beta", platform: "windows" }), {
      event: "release_download_clicked", dim1: "beta", dim2: "windows",
    });
    assert.deepEqual(parseSiteCount({ event: "download_cta_clicked", surface: "hero_tone", platform: "mac-arm" }), {
      event: "download_cta_clicked", dim1: "other", dim2: "other",
    });
    for (const body of [{ event: "visit_source" }, { event: "toString" }, { event: "beta_install_copied" }, "download_cta_clicked", null]) {
      assert.equal(parseSiteCount(body), null, JSON.stringify(body));
    }
  });
});

describe("first touch", () => {
  it("keeps the first tagged landing and ignores later tags and ref", () => {
    const storage = fakeStorage();
    assert.deepEqual(rememberFirstTouch("?utm_source=Instagram&utm_campaign=profile&ref=ab12cd34", storage), {
      source: "instagram", campaign: "profile",
    });
    assert.deepEqual(rememberFirstTouch("?utm_source=tiktok", storage), { source: "instagram", campaign: "profile" });
    assert.deepEqual(rememberFirstTouch("", storage), { source: "instagram", campaign: "profile" });
    assert.equal(storage.data.get(FIRST_TOUCH_KEY)?.includes("ab12cd34"), false);
  });

  it("is empty for an untagged visitor, and a later tagged landing becomes the first touch", () => {
    const storage = fakeStorage();
    assert.deepEqual(rememberFirstTouch("?ref=ab12cd34", storage), { source: "", campaign: "" });
    assert.equal(storage.data.has(FIRST_TOUCH_KEY), false);
    assert.deepEqual(rememberFirstTouch("?utm_source=x&utm_campaign=x-p0", storage), { source: "x", campaign: "x-p0" });
  });

  it("still reports this page's tags when storage is blocked", () => {
    const blocked: OptOutStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    assert.deepEqual(rememberFirstTouch("?utm_source=youtube&utm_campaign=channel", blocked), { source: "youtube", campaign: "channel" });
  });

  it("a first-touch older than 30 days is dropped", () => {
    const storage = fakeStorage();
    const start = Date.UTC(2026, 9, 1);
    rememberFirstTouch("?utm_source=instagram&utm_campaign=profile", storage, start);
    const justInside = start + FIRST_TOUCH_MAX_AGE_MS - 1;
    assert.deepEqual(rememberFirstTouch("?utm_source=tiktok", storage, justInside), { source: "instagram", campaign: "profile" });
    const expired = start + FIRST_TOUCH_MAX_AGE_MS;
    assert.deepEqual(rememberFirstTouch("", storage, expired), { source: "", campaign: "" }, "an untagged visit after 30 days is direct");
    assert.equal(storage.data.has(FIRST_TOUCH_KEY), false, "the expired first touch is removed");
    assert.deepEqual(rememberFirstTouch("?utm_source=tiktok&utm_campaign=x-p0", storage, expired + 1), { source: "tiktok", campaign: "x-p0" });
    assert.deepEqual(rememberFirstTouch("?utm_source=github", storage, expired + 2), { source: "tiktok", campaign: "x-p0" }, "the next tagged visit replaced it");
  });

  it("treats a stored first touch without a time as expired", () => {
    const storage = fakeStorage({ [FIRST_TOUCH_KEY]: JSON.stringify({ source: "instagram", campaign: "profile" }) });
    assert.deepEqual(rememberFirstTouch("?utm_source=youtube&utm_campaign=channel", storage), { source: "youtube", campaign: "channel" });
  });
});

describe("visit hit", () => {
  it("sends the first-touch channel with the visitor's first hit of the day", () => {
    const storage = fakeStorage();
    installWindow({ search: "?utm_source=x&utm_campaign=profile", storage });
    sendVisitHit(new Date("2026-10-27T18:00:00Z"));
    const [hit] = sentTo("/api/stats/hit");
    assert.deepEqual(Reflect.get(Object(hit), "channel"), { source: "x", campaign: "profile" });
    assert.equal(Reflect.get(Object(hit), "visitorId"), storage.data.get("unvibe_anon_id"));
    assert.equal(storage.data.get(CHANNEL_DAY_KEY), "2026-10-27");
  });

  it("a second beacon the same day sends no channel", () => {
    const storage = fakeStorage();
    installWindow({ search: "?utm_source=x&utm_campaign=profile", storage });
    sendVisitHit(new Date("2026-10-27T15:00:00Z"));
    installWindow({ pathname: "/pricing", storage });
    sendVisitHit(new Date("2026-10-27T20:00:00Z"));
    installWindow({ search: "?utm_source=x&utm_campaign=profile", storage });
    // 06:59 UTC on the 28th is still the 27th in Pacific time, the server's stats day.
    sendVisitHit(new Date("2026-10-28T06:59:00Z"));
    // The next Pacific day sends it again.
    sendVisitHit(new Date("2026-10-28T07:00:00Z"));
    const channels = sentTo("/api/stats/hit").map((hit) => Reflect.get(Object(hit), "channel"));
    assert.deepEqual(channels, [
      { source: "x", campaign: "profile" },
      undefined,
      undefined,
      { source: "x", campaign: "profile" },
    ]);
  });

  it("sends direct / none as an empty channel once a day for an untagged visitor", () => {
    const storage = fakeStorage();
    installWindow({ storage });
    sendVisitHit(new Date("2026-10-27T18:00:00Z"));
    sendVisitHit(new Date("2026-10-27T19:00:00Z"));
    const channels = sentTo("/api/stats/hit").map((hit) => Reflect.get(Object(hit), "channel"));
    assert.deepEqual(channels, [{ source: "", campaign: "" }, undefined]);
  });

  for (const [label, options] of [
    ["?notrack=1", { search: "?notrack=1&utm_source=x&utm_campaign=profile" }],
    ["an earlier ?notrack=1", { search: "?utm_source=x", storage: fakeStorage({ unvibe_notrack: "1" }) }],
    ["an automated browser", { search: "?utm_source=x", webdriver: true }],
  ] as const) {
    it(`sends nothing for ${label}`, () => {
      installWindow(options);
      sendVisitHit();
      trackDownloadClick("hero", "mac");
      trackDownloadPageClick("nav");
      trackReleaseDownload("beta", "mac", "page");
      assert.deepEqual(requests, []);
    });
  }

  for (const pathname of ["/activate", "/redeem", "/s/abc", "/founder", "/waitlist-admin"]) {
    it(`sends no channel and no download count on ${pathname}`, () => {
      const storage = fakeStorage();
      installWindow({ pathname, search: "?utm_source=x&utm_campaign=profile", storage });
      sendVisitHit();
      trackDownloadClick("activate", "mac");
      trackReleaseDownload("beta", "mac", "page");
      for (const hit of sentTo("/api/stats/hit")) assert.equal(Reflect.get(Object(hit), "channel"), undefined);
      assert.deepEqual(sentTo("/api/stats/event"), []);
      assert.equal(storage.data.has(FIRST_TOUCH_KEY), false, "the tags are not remembered there either");
      assert.equal(storage.data.has(CHANNEL_DAY_KEY), false, "and the day's channel is still to send from a public page");
    });
  }
});

describe("download counts", () => {
  it("counts each download event once with its surface and platform", () => {
    trackDownloadClick("hero", "windows");
    trackDownloadPageClick("pricing");
    trackReleaseDownload("home_install", "mac", "hero");
    assert.deepEqual(sentTo("/api/stats/event"), [
      { event: "download_cta_clicked", surface: "hero", platform: "windows" },
      { event: "download_cta_clicked", surface: "pricing", platform: "other" },
      { event: "release_download_clicked", surface: "home_install", platform: "mac" },
    ]);
    const release = sentTo("/api/analytics").find((body) => Reflect.get(Object(body), "event") === "release_download_clicked");
    assert.deepEqual(Reflect.get(Object(release), "properties"), { os: "mac", surface: "hero", path: "/" }, "Mixpanel props are unchanged");
  });
});
