import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import nextConfig from "../../next.config.mjs";
import apiConfig from "../../../web/next.config.mjs";
import { ENFORCED_CSP, LISTING_IMAGE_HOSTS, REPORTING_ENDPOINTS, reportOnlyCsp } from "./csp.mjs";
import { listingBadges } from "../data/listings";
import { CSP_REPORT_MAX_BYTES, createCspCollector, violationsFrom } from "./cspReport";
import { POST } from "../app/api/csp-report/route";

const legacy = (report: Record<string, unknown>) => ({ "csp-report": report });

function report(body: string, type = "application/csp-report", headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/csp-report", { method: "POST", headers: { "content-type": type, ...headers }, body });
}

describe("unvibe.site sends the C3 policies on every page (Security C3)", () => {
  it("enforces exactly the four safe directives and reports the strict policy", async () => {
    assert.equal(ENFORCED_CSP, "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    const all = (await nextConfig.headers!()).find((rule) => rule.source === "/:path*")!.headers;
    const header = (key: string) => all.find((h) => h.key === key)?.value;
    assert.equal(header("Content-Security-Policy"), ENFORCED_CSP);
    assert.equal(header("Reporting-Endpoints"), REPORTING_ENDPOINTS);
    const strict = header("Content-Security-Policy-Report-Only") ?? "";
    assert.match(strict, /script-src 'self' /);
    assert.doesNotMatch(strict, /script-src[^;]*'unsafe-inline'/);
    assert.match(strict, /report-uri \/api\/csp-report/);
    assert.match(strict, /report-to csp/);
  });

  it("api.unvibe.site enforces the same four directives on every response", async () => {
    const all = (await apiConfig.headers!()).find((rule) => rule.source === "/:path*")!.headers;
    assert.equal(all.find((h) => h.key === "Content-Security-Policy")?.value, ENFORCED_CSP);
  });

  it("the strict policy names the API and Supabase origins it is given, and ignores junk", () => {
    const strict = reportOnlyCsp({ api: "https://api.example.test/", supabase: "https://abc.supabase.co" });
    assert.match(strict, /connect-src 'self' https:\/\/api\.example\.test https:\/\/abc\.supabase\.co /);
    assert.doesNotMatch(reportOnlyCsp({ api: "not a url", supabase: "" }), /not a url/);
  });

  it("every footer listing badge's image origin is allowed in img-src", () => {
    const imgSrc = reportOnlyCsp().split("; ").find((d) => d.startsWith("img-src ")) ?? "";
    for (const badge of listingBadges) {
      const host = new URL(badge.src).origin;
      assert.ok(LISTING_IMAGE_HOSTS.includes(host) && imgSrc.includes(` ${host}`), badge.name);
    }
  });

  it("no form on either site posts to another origin (form-action 'self' would block it)", () => {
    const roots = ["src", "../web/app", "../web/src"].map((dir) => path.resolve(dir));
    const offsite: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) {
          if (name !== "node_modules" && !name.startsWith(".")) walk(file);
        } else if (/\.(tsx|jsx|html)$/.test(name) && !/\.test\./.test(name)) {
          for (const match of Array.from(readFileSync(file, "utf8").matchAll(/<form\b[^>]*\baction=\{?["'`]([^"'`]+)/g))) {
            if (/^(https?:)?\/\//i.test(match[1] ?? "")) offsite.push(`${file}: ${match[1]}`);
          }
        }
      }
    };
    for (const root of roots) walk(root);
    assert.deepEqual(offsite, []);
  });
});

describe("/api/csp-report keeps only directive, origin and path (Security C3 condition 4)", () => {
  it("keeps the path without query or fragment, the blocked origin, and never the script sample", () => {
    const [v] = violationsFrom(legacy({
      "document-uri": "https://unvibe.site/activate?email=someone%40example.com#code",
      "effective-directive": "script-src-elem",
      "blocked-uri": "https://evil.example/x.js?token=abc",
      "script-sample": "alert(document.cookie)",
      referrer: "https://ref.example/?q=1",
    }), "application/csp-report");
    assert.deepEqual(v, { directive: "script-src-elem", blocked: "https://evil.example", path: "/activate" });
    assert.doesNotMatch(JSON.stringify(v), /email|token|alert|ref\.example/);
  });

  it("reads Reporting API reports, keeps inline and eval as words, and skips other report types", () => {
    const got = violationsFrom([
      { type: "csp-violation", body: { documentURL: "https://unvibe.site/", effectiveDirective: "script-src-elem", blockedURL: "inline", sample: "self.__next_f.push" } },
      { type: "csp-violation", body: { documentURL: "https://unvibe.site/pricing", effectiveDirective: "script-src", blockedURL: "eval" } },
      { type: "deprecation", body: { documentURL: "https://unvibe.site/" } },
    ], "application/reports+json");
    assert.deepEqual(got, [
      { directive: "script-src-elem", blocked: "inline", path: "/" },
      { directive: "script-src", blocked: "eval", path: "/pricing" },
    ]);
  });

  it("the stats key, explain ids and other URL values never reach a log line (Security C3-M1)", () => {
    const key = "Zq8rT3vYk2LmN9pW";
    const urls = [
      `https://unvibe.site/s/${key}`,
      `https://unvibe.site/s/${key}/`,
      "https://unvibe.site/explain/python-list-comprehension",
      "https://unvibe.site/invite/abc123TOKEN",
      "https://unvibe.site/Someone@Example.com",
      "https://unvibe.site/pricing",
    ];
    const lines: string[] = [];
    const collector = createCspCollector({ log: (line) => lines.push(line) });
    const got = urls.flatMap((url) =>
      violationsFrom(legacy({ "document-uri": url, "violated-directive": "script-src-elem", "blocked-uri": "inline" }), "application/csp-report"));
    assert.deepEqual(got.map((v) => v.path), ["/s/:param", "/s/:param", "/explain/:param", "/invite/:param", "/:param", "/pricing"]);
    collector.add(got, 0);
    collector.flush();
    assert.ok(lines.length > 0);
    for (const line of lines) assert.doesNotMatch(line, new RegExp(`${key}|comprehension|TOKEN|Someone|Example`));
  });

  it("logs one line per (directive, blocked, path) per minute, with counts", () => {
    const lines: string[] = [];
    const collector = createCspCollector({ log: (line) => lines.push(line) });
    const v = { directive: "script-src-elem", blocked: "inline", path: "/" };
    collector.add([v, v, v], 60_000 * 10 + 1);
    assert.deepEqual(lines, []);
    collector.add([], 60_000 * 11 + 1);
    assert.equal(lines.length, 1);
    assert.match(lines[0] ?? "", /"count":3/);
  });

  it("drops reports over the per-minute cap and logs how many", () => {
    const lines: string[] = [];
    const collector = createCspCollector({ limitPerMinute: 60, log: (line) => lines.push(line) });
    const v = { directive: "img-src", blocked: "https://cdn.example", path: "/" };
    collector.add(Array.from({ length: 75 }, () => v), 0);
    collector.flush();
    assert.ok(lines.some((line) => /"count":60/.test(line)));
    assert.ok(lines.some((line) => /"dropped":15/.test(line)));
  });

  it("the route answers 204 with no body, 413 over 8 KiB, 415 for other content types", async () => {
    const ok = await POST(report(JSON.stringify(legacy({ "document-uri": "https://unvibe.site/", "violated-directive": "img-src", "blocked-uri": "data:" }))));
    assert.equal(ok.status, 204);
    assert.equal(await ok.text(), "");
    const big = "x".repeat(CSP_REPORT_MAX_BYTES + 1);
    assert.equal((await POST(report(big))).status, 413);
    assert.equal((await POST(report(big, "application/csp-report", { "content-length": String(big.length) }))).status, 413);
    assert.equal((await POST(report("{}", "application/json"))).status, 415);
    assert.equal((await POST(report("not json"))).status, 204);
  });
});
