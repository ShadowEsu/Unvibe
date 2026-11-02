import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";
import { reportOnlyCsp } from "./csp.mjs";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

const ROOT = path.join(process.cwd());

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
  });
}

// BOSS 31 Oct: the site keeps Mixpanel only. Re-adding PostHog would send visitors' data to a provider the
// privacy page says the site no longer uses (Security PH-3).
describe("unvibe.site sends nothing to PostHog", () => {
  it("has no posthog-js dependency and no PostHog host in the CSP", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as Record<string, Record<string, string> | undefined>;
    for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
      assert.equal(Object.keys(pkg[field] ?? {}).some((name) => /posthog/i.test(name)), false, field);
    }
    assert.doesNotMatch(reportOnlyCsp({ supabase: "https://example.supabase.co" }), /posthog/i);
  });

  it("no site source mentions PostHog except the startup-program list", () => {
    const allowed = new Set(["src/data/compensation.ts", "src/data/milestones.ts", "src/app/privacy/page.tsx"]);
    const offenders = sourceFiles(path.join(ROOT, "src"))
      .map((file) => path.relative(ROOT, file))
      .filter((file) => !allowed.has(file) && /posthog/i.test(readFileSync(path.join(ROOT, file), "utf8")));
    assert.deepEqual(offenders, []);
  });

  it("the privacy page lists Mixpanel as the analytics provider and dates the end of PostHog", () => {
    const page = renderToStaticMarkup(createElement(PrivacyPage)).replace(/\s+/g, " ");
    assert.match(page, /<strong>Mixpanel<\/strong> measures website usage\./);
    assert.match(page, /Until 2 November 2026 unvibe\.site also sent the same consented analytics to PostHog: events, with your IP address used to estimate a rough location, and session replays with all page text hidden\. That data stays with PostHog until we delete it, which we will do after exporting it\./);
    assert.match(page, /<strong>PostHog<\/strong> still holds the website analytics and replays recorded until 2 November 2026, until we delete them; the site no longer sends it anything\./);
  });
});
