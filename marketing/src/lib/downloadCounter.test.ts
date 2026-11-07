import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { NextRequest, type NextFetchEvent } from "next/server";
import { GET, HEAD } from "@/app/download/[file]/route";
import { middleware } from "@/middleware";
import {
  BETA_INSTALL_TAG,
  BETA_MAC_DOWNLOAD_URL,
  BETA_MAC_INTEL_DOWNLOAD_URL,
  BETA_WINDOWS_ASSET,
  BETA_WINDOWS_DOWNLOAD_URL,
} from "@/lib/betaInstallScript";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_MAC_INTEL_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import {
  DOWNLOAD_FILES,
  downloadFile,
  downloadSource,
  isCountedDownload,
  recordDownload,
  type DownloadRequest,
} from "@/lib/downloadCounter";
import { DOWNLOAD_FILE_NAMES } from "@/lib/downloadFiles";
import { thanksHref } from "@/site/dia/DownloadCta";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const SITE = "https://unvibe.site";

function req(overrides: Partial<{ method: string; search: string; headers: Record<string, string> }> = {}): DownloadRequest {
  const headers: Record<string, string> = { host: "unvibe.site", "user-agent": CHROME, ...overrides.headers };
  return {
    method: overrides.method ?? "GET",
    search: new URLSearchParams(overrides.search ?? ""),
    header: (name) => headers[name] ?? null,
  };
}

describe("download files (fixed map, this release only)", () => {
  it("sends each name to this release's asset on GitHub, so a tag bump moves every link", () => {
    assert.deepEqual(Object.keys(DOWNLOAD_FILES).sort(), [...DOWNLOAD_FILE_NAMES].sort());
    for (const [file, { url }] of Object.entries(DOWNLOAD_FILES)) {
      assert.ok(url.startsWith(`https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/`), `${file}: ${url}`);
    }
    assert.match(DOWNLOAD_FILES.mac.url, /mac-arm64\.dmg$/);
    assert.match(DOWNLOAD_FILES["mac-intel"].url, /mac-x64\.dmg$/);
    assert.match(DOWNLOAD_FILES.windows.url, /win-x64-.*\.exe$/);
  });

  it("follows the release's own file constants, so switching the Windows file (portable → setup.exe at 0.1.50) moves the link", () => {
    assert.equal(DOWNLOAD_FILES.mac.url, BETA_MAC_DOWNLOAD_URL);
    assert.equal(DOWNLOAD_FILES["mac-intel"].url, BETA_MAC_INTEL_DOWNLOAD_URL);
    assert.equal(DOWNLOAD_FILES.windows.url, BETA_WINDOWS_DOWNLOAD_URL);
    assert.ok(DOWNLOAD_FILES.windows.url.endsWith(`/${BETA_WINDOWS_ASSET}`));
  });

  it("stores only the assets migration 0014 allows", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0014_download_days.sql"), "utf8");
    const check = sql.match(/asset\s+text\s+not null check \(asset in \(([^)]*)\)\)/);
    assert.ok(check, "0014 has the asset check");
    const allowed = Array.from(check[1].matchAll(/'([a-z_]+)'/g), (m) => m[1]).sort();
    assert.deepEqual(Object.values(DOWNLOAD_FILES).map((f) => f.asset).sort(), allowed);
  });

  it("knows only those names: nothing else, no prototype keys", () => {
    assert.equal(downloadFile("mac"), "mac");
    for (const s of ["thanks", "Mac", "mac.dmg", "constructor", "__proto__", "toString", "", "../beta"]) {
      assert.equal(downloadFile(s), null, s);
    }
  });

  it("every site download link goes through the counter on the page's own host", () => {
    assert.equal(BETA_MAC_DIRECT_DOWNLOAD, "/download/mac");
    assert.equal(BETA_MAC_INTEL_DIRECT_DOWNLOAD, "/download/mac-intel");
    assert.equal(BETA_WINDOWS_DIRECT_DOWNLOAD, "/download/windows");
  });
});

describe("which download requests count", () => {
  it("counts a browser's GET", () => {
    assert.equal(isCountedDownload(req()), true);
  });

  it("doesn't count HEAD, link previews, crawlers, scripts, prefetches or our own ?notrack=1 visits", () => {
    assert.equal(isCountedDownload(req({ method: "HEAD" })), false);
    for (const ua of ["Googlebot/2.1", "Slackbot-LinkExpanding 1.0", "facebookexternalhit/1.1", "curl/8.7.1", "Wget/1.21", "python-requests/2.32", "Mozilla/5.0 HeadlessChrome/141.0", ""]) {
      assert.equal(isCountedDownload(req({ headers: { "user-agent": ua } })), false, ua);
    }
    assert.equal(isCountedDownload(req({ headers: { purpose: "prefetch" } })), false);
    assert.equal(isCountedDownload(req({ headers: { "sec-purpose": "prefetch;prerender" } })), false);
    assert.equal(isCountedDownload(req({ search: "notrack=1" })), false);
    assert.equal(isCountedDownload(req({ headers: { referer: `${SITE}/beta?notrack=1` } })), false);
  });

  it("counts a link click (a document navigation) but not another site embedding the address", () => {
    assert.equal(isCountedDownload(req({ headers: { "sec-fetch-dest": "document" } })), true);
    for (const dest of ["image", "empty", "iframe", "script"]) {
      assert.equal(isCountedDownload(req({ headers: { "sec-fetch-dest": dest } })), false, dest);
    }
  });
});

describe("download source (utm_source only, closed list)", () => {
  it("uses the link's own utm_source first", () => {
    assert.equal(downloadSource(req({ search: "utm_source=email", headers: { referer: `${SITE}/beta?utm_source=devhunt` } })), "email");
  });

  it("else the utm_source of the unvibe.site page the click came from", () => {
    assert.equal(downloadSource(req({ headers: { referer: `${SITE}/beta?utm_source=DevHunt&utm_medium=directory` } })), "devhunt");
    assert.equal(downloadSource(req({ headers: { referer: `${SITE}/beta` } })), "none");
    assert.equal(downloadSource(req({ headers: { referer: `${SITE}/?utm_source=someone-new` } })), "other");
  });

  it("ignores other sites' pages and broken referrers", () => {
    assert.equal(downloadSource(req({ headers: { referer: "https://devhunt.org/?utm_source=devhunt" } })), "none");
    assert.equal(downloadSource(req({ headers: { referer: "https://unvibe.site.evil.example/?utm_source=x" } })), "none");
    assert.equal(downloadSource(req({ headers: { referer: "not a url" } })), "none");
    assert.equal(downloadSource(req()), "none");
    assert.equal(downloadSource(req({ headers: { host: "", referer: `${SITE}/beta?utm_source=devhunt` } })), "none");
  });

  it("matches the page by this request's host, so preview deployments and proxies work", () => {
    const preview = "unvibe-site-git-x-shadowesu.vercel.app";
    assert.equal(downloadSource(req({ headers: { host: preview, referer: `https://${preview}/beta?utm_source=g2` } })), "g2");
    assert.equal(downloadSource(req({ headers: { host: "127.0.0.1:3103", "x-forwarded-host": "unvibe.site", referer: `${SITE}/?utm_source=g2` } })), "g2");
    assert.equal(downloadSource(req({ headers: { host: preview, referer: `${SITE}/?utm_source=g2` } })), "none");
  });

  it("survives the one-click button's move to the thank-you state, which keeps utm_source and notrack only", () => {
    assert.equal(thanksHref("mac-arm", "?utm_source=devhunt&utm_medium=directory&ref=abc"), "/beta?dl=mac-arm&utm_source=devhunt#thanks");
    assert.equal(thanksHref("windows", ""), "/beta?dl=windows#thanks");
    const thanks = new URL(thanksHref("mac-intel", "?utm_source=DevHunt"), SITE).toString();
    assert.equal(downloadSource(req({ headers: { referer: thanks } })), "devhunt");
    const own = new URL(thanksHref("mac-arm", "?notrack=1&utm_source=x"), SITE).toString();
    assert.equal(own, `${SITE}/beta?dl=mac-arm&utm_source=x&notrack=1#thanks`);
    assert.equal(isCountedDownload(req({ headers: { referer: own } })), false);
  });
});

describe("recordDownload", () => {
  it("posts the Pacific day, asset and source, nothing else", async () => {
    const calls: unknown[][] = [];
    const ok = await recordDownload("mac_intel", "devhunt", async (...args) => {
      calls.push(args);
      return true;
    }, new Date("2026-11-07T07:30:00Z"));
    assert.equal(ok, true);
    assert.deepEqual(calls, [["2026-11-06", "mac_intel", "devhunt"]]);
  });

  it("gives up after waitMs and on errors, without throwing", async () => {
    const started = Date.now();
    assert.equal(await recordDownload("mac", "none", () => new Promise<boolean>(() => {}), new Date(), 50), false);
    assert.ok(Date.now() - started < 1000);
    assert.equal(await recordDownload("mac", "none", async () => { throw new Error("down"); }), false);
    assert.equal(await recordDownload("mac", "none", async () => false), false);
    assert.equal(await recordDownload("mac", "none", null), false);
  });
});

describe("/download/<file>: the route redirects, the middleware counts", () => {
  let server: Server;
  let bodies: Record<string, unknown>[] = [];
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };

  before(async () => {
    server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        if (request.url === "/rest/v1/rpc/record_download") bodies.push(JSON.parse(body) as Record<string, unknown>);
        response.writeHead(204).end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  beforeEach(() => {
    bodies = [];
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [name, value] of [["SUPABASE_URL", saved.url], ["SUPABASE_SERVICE_ROLE_KEY", saved.key]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const route = (method: "GET" | "HEAD", file: string, query = "") =>
    (method === "GET" ? GET : HEAD)(new Request(`${SITE}/download/${file}${query}`, { method }), { params: { file } });

  /** Runs the middleware for a request and waits for whatever it handed to waitUntil. */
  async function count(path: string, headers: Record<string, string> = {}, method = "GET") {
    const waits: Promise<unknown>[] = [];
    const event = { waitUntil: (p: Promise<unknown>) => waits.push(p) } as unknown as NextFetchEvent;
    const res = middleware(new NextRequest(`${SITE}${path}`, { method, headers: { host: "unvibe.site", "user-agent": CHROME, ...headers } }), event);
    await Promise.all(waits);
    return { res, waits };
  }

  it("the route answers at once with a 302 to the release asset, uncached, without passing the query on", () => {
    for (const file of DOWNLOAD_FILE_NAMES) {
      const res = route("GET", file, "?utm_source=email&next=https://evil.example");
      assert.equal(res.status, 302);
      assert.equal(res.headers.get("location"), DOWNLOAD_FILES[file].url);
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
    assert.equal(route("HEAD", "mac").headers.get("location"), DOWNLOAD_FILES.mac.url);
  });

  it("the route answers 404 for any other name, with no redirect", () => {
    for (const file of ["thanks", "linux", "__proto__", "mac.dmg"]) {
      const res = route("GET", file);
      assert.equal(res.status, 404, file);
      assert.equal(res.headers.get("location"), null, file);
    }
  });

  it("the middleware counts a click once, after the response, and passes the request through untouched", async () => {
    const { res, waits } = await count("/download/windows?utm_source=email", {
      referer: `${SITE}/beta?utm_source=devhunt`,
      "sec-fetch-dest": "document",
      accept: "*/*",
    });
    assert.equal(res.headers.get("x-middleware-next"), "1");
    assert.equal(res.headers.get("location"), null);
    assert.equal(waits.length, 1);
    assert.equal(bodies.length, 1);
    assert.deepEqual(Object.keys(bodies[0]).sort(), ["p_asset", "p_day", "p_source"]);
    assert.equal(bodies[0].p_asset, "windows");
    assert.equal(bodies[0].p_source, "email");
  });

  it("the middleware doesn't count HEAD, bots, embeds or unknown names as downloads", async () => {
    for (const [path, headers, method] of [
      ["/download/mac", {}, "HEAD"],
      ["/download/mac", { "user-agent": "WhatsApp/2.24" }, "GET"],
      ["/download/mac", { "sec-fetch-dest": "image" }, "GET"],
      ["/download/linux", { accept: "text/html", "sec-fetch-dest": "document" }, "GET"],
    ] as const) {
      await count(path, headers, method);
    }
    assert.equal(bodies.length, 0);
  });
});
