import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { NextRequest, type NextFetchEvent } from "next/server";
import { middleware } from "@/middleware";
import { dayKey } from "@/lib/siteStatsStore";
import {
  SITE_LOAD_SOURCES,
  isCountedLoad,
  recordSiteLoad,
  siteLoadDay,
  siteLoadSource,
  type DocumentRequest,
} from "@/lib/siteLoads";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

function doc(overrides: Partial<{ method: string; pathname: string; search: string; headers: Record<string, string> }> = {}): DocumentRequest {
  const headers: Record<string, string> = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "sec-fetch-dest": "document",
    "user-agent": CHROME,
    ...overrides.headers,
  };
  return {
    method: overrides.method ?? "GET",
    pathname: overrides.pathname ?? "/",
    search: new URLSearchParams(overrides.search ?? ""),
    header: (name) => headers[name] ?? null,
  };
}

describe("site load source (Security E1-2: utm_source only, closed list)", () => {
  it("counts a dictionary source by name, whatever its case or spacing", () => {
    assert.equal(siteLoadSource(new URLSearchParams("utm_source=instagram&utm_medium=social")), "instagram");
    assert.equal(siteLoadSource(new URLSearchParams("utm_source=%20LaunchingNext%20")), "launchingnext");
  });

  it("files a missing source as none and anything off the list as other", () => {
    assert.equal(siteLoadSource(new URLSearchParams("")), "none");
    assert.equal(siteLoadSource(new URLSearchParams("utm_source=")), "none");
    assert.equal(siteLoadSource(new URLSearchParams("utm_source=someone@example.com")), "other");
    assert.equal(siteLoadSource(new URLSearchParams("utm_source=constructor")), "other");
    assert.equal(siteLoadSource(new URLSearchParams(`utm_source=${"x".repeat(41)}`)), "other");
  });

  it("reads no other parameter, even when it carries a dictionary value", () => {
    for (const q of ["utm_content=instagram", "ref=github", "gclid=github", "utm_campaign=youtube", "src=x"]) {
      assert.equal(siteLoadSource(new URLSearchParams(q)), "none", q);
    }
  });

  it("matches the allowlist migrations 0013 and 0014 seed, so no counted source is refused by the foreign key", () => {
    const seeded = ["0013_site_load_days.sql", "0014_download_days.sql"].flatMap((file) => {
      const sql = readFileSync(path.join(process.cwd(), "supabase/migrations", file), "utf8");
      const insert = sql.slice(sql.indexOf("insert into public.site_load_sources"), sql.indexOf("on conflict (source)"));
      return Array.from(insert.matchAll(/\('([a-z0-9]+)'\)/g), (m) => m[1]);
    });
    assert.equal(new Set(seeded).size, seeded.length, "no source is seeded twice");
    assert.deepEqual(seeded.sort(), [...SITE_LOAD_SOURCES, "none", "other"].sort());
  });
});

describe("which requests count as a page load", () => {
  it("counts a browser's GET for a page, with or without a campaign", () => {
    assert.equal(isCountedLoad(doc()), true);
    assert.equal(isCountedLoad(doc({ pathname: "/pricing", search: "utm_source=github" })), true);
    // Older browsers send no Sec-Fetch-Dest; the Accept header decides.
    const noFetchMeta = doc();
    assert.equal(isCountedLoad({ ...noFetchMeta, header: (n) => (n === "sec-fetch-dest" ? null : noFetchMeta.header(n)) }), true);
  });

  it("skips prefetches, client-side navigations, non-GET and non-document requests", () => {
    assert.equal(isCountedLoad(doc({ method: "HEAD" })), false);
    assert.equal(isCountedLoad(doc({ method: "POST" })), false);
    assert.equal(isCountedLoad(doc({ headers: { rsc: "1" } })), false);
    assert.equal(isCountedLoad(doc({ headers: { "next-router-prefetch": "1" } })), false);
    assert.equal(isCountedLoad(doc({ headers: { purpose: "prefetch" } })), false);
    assert.equal(isCountedLoad(doc({ headers: { "sec-purpose": "prefetch;prerender" } })), false);
    assert.equal(isCountedLoad(doc({ headers: { "sec-fetch-dest": "image" } })), false);
    assert.equal(isCountedLoad(doc({ headers: { accept: "*/*" } })), false);
  });

  it("skips our own ?notrack=1 visits, bots and headless browsers, and private pages", () => {
    assert.equal(isCountedLoad(doc({ search: "notrack=1&utm_source=github" })), false);
    for (const ua of ["Googlebot/2.1", "Mozilla/5.0 HeadlessChrome/141.0", "curl/8.7.1", "facebookexternalhit/1.1", "Chrome-Lighthouse", ""]) {
      assert.equal(isCountedLoad(doc({ headers: { "user-agent": ua } })), false, ua);
    }
    const cubot = "Mozilla/5.0 (Linux; Android 12; CUBOT X50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36";
    assert.equal(isCountedLoad(doc({ headers: { "user-agent": cubot } })), true);
    for (const p of ["/console", "/console/users", "/stats", "/stats.html", "/waitlist", "/waitlist-admin", "/s/k3y", "/activate", "/redeem", "/download/mac", "/download/mac-intel", "/download/windows"]) {
      assert.equal(isCountedLoad(doc({ pathname: p })), false, p);
    }
    for (const p of ["/statsig-alternatives", "/consoles", "/use-cases/s3", "/security", "/download/thanks", "/download/macos-guide"]) {
      assert.equal(isCountedLoad(doc({ pathname: p })), true, p);
    }
  });
});

describe("site load day and storage", () => {
  it("uses the same Pacific day as the rest of the site's counters, across both DST changes", () => {
    for (const iso of ["2026-11-06T07:59:59Z", "2026-11-06T08:00:00Z", "2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z", "2027-03-14T09:59:00Z", "2027-03-14T10:01:00Z"]) {
      assert.equal(siteLoadDay(new Date(iso)), dayKey(new Date(iso)), iso);
    }
  });

  it("stores only the day and the source, and never throws when storage fails", async () => {
    const calls: unknown[][] = [];
    const ok = async (...args: unknown[]) => {
      calls.push(args);
      return true;
    };
    assert.equal(await recordSiteLoad("youtube", ok, new Date("2026-11-06T07:30:00Z")), true);
    assert.deepEqual(calls, [["2026-11-05", "youtube"]]);
    assert.equal(await recordSiteLoad("none", async () => false), false);
    assert.equal(await recordSiteLoad("none", () => Promise.reject(new Error("network down"))), false);
    assert.equal(await recordSiteLoad("none", null), false);
  });
});

describe("middleware never changes the response", () => {
  // Storage is switched off for these tests, so a machine that has the real Supabase settings never
  // writes a count from `npm test`.
  function run(url: string, headers: Record<string, string>) {
    const saved = [process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY];
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const waits: Promise<unknown>[] = [];
      // A test double: the middleware only ever calls waitUntil on its event.
      const event = { waitUntil: (p: Promise<unknown>) => waits.push(p) } as unknown as NextFetchEvent;
      const res = middleware(new NextRequest(url, { headers }), event);
      return { res, waits };
    } finally {
      if (saved[0] !== undefined) process.env.SUPABASE_URL = saved[0];
      if (saved[1] !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved[1];
    }
  }

  it("passes the page through untouched and counts it after the response", async () => {
    const { res, waits } = run("https://unvibe.site/?utm_source=github", { accept: "text/html", "sec-fetch-dest": "document", "user-agent": CHROME });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-middleware-next"), "1");
    for (const changed of ["location", "x-middleware-rewrite", "set-cookie", "content-security-policy"]) {
      assert.equal(res.headers.get(changed), null, changed);
    }
    assert.equal(waits.length, 1);
    await Promise.all(waits);
  });

  it("does not count a bot or a prefetch, and still passes it through", () => {
    const cases: Record<string, string>[] = [
      { accept: "text/html", "user-agent": "Googlebot/2.1" },
      { accept: "text/html", "user-agent": CHROME, "next-router-prefetch": "1" },
    ];
    for (const headers of cases) {
      const { res, waits } = run("https://unvibe.site/pricing", headers);
      assert.equal(res.headers.get("x-middleware-next"), "1");
      assert.equal(waits.length, 0);
    }
  });
});
