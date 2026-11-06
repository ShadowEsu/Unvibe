import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AboutPage from "@/app/about/page";
import { Download } from "@/site/Download";
import { PricingCards } from "@/site/PricingCards";
import { pricingCopy } from "./pricingCopy";
import { faqItems } from "@/data/faq";
import { ALLOWANCE } from "./allowance";

Object.assign(globalThis, { React });

const srcRoot = fileURLToPath(new URL("..", import.meta.url));
const text = (element: React.ReactElement) => renderToStaticMarkup(element).replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const VAGUE = /usage limit|usage allowance|monthly limit|free allowance|More explanations each month/i;

describe("explanation allowances", () => {
  it("match the numbers the product enforces", () => {
    assert.deepEqual(ALLOWANCE, { trialExplanations: 50, trialTestMe: 50, trialDays: 30, freeMonthly: 50, proMonthly: 200 });
  });

  it("/pricing states signed out, Free and Pro numbers", () => {
    for (const paymentsOpen of [false, true]) {
      const page = text(createElement(PricingCards, { copy: pricingCopy(paymentsOpen), paymentsOpen }));
      assert.match(page, /50 explanations in your first 30 days without signing in, then 50 explanations a month when you sign in\./);
      assert.match(page, /200 AI explanations a month/);
      assert.doesNotMatch(page, /100 (AI )?explanations/);
      assert.doesNotMatch(page, VAGUE);
    }
  });

  it("/beta states the trial and the Free month", () => {
    const page = text(createElement(Download));
    assert.match(page, /you get 50 explanations \(follow-up questions count toward these\) and 50 Test me questions in your first 30 days\. Signing in gives you 50 explanations a month on Free/);
    assert.doesNotMatch(page, VAGUE);
  });

  it("the FAQ and /about say the same", () => {
    const free = faqItems.find((item) => item.id === "free")?.answer ?? "";
    assert.match(free, /50 explanations in your first 30 days without signing in, then 50 explanations a month when you sign in\./);
    const about = text(createElement(AboutPage));
    assert.match(about, /Free: 50 explanations in your first 30 days without signing in, then 50 explanations a month when you sign in\./);
    for (const copy of [free, about]) assert.doesNotMatch(copy, VAGUE);
  });

  it("are written only in lib/allowance", async () => {
    const offenders: string[] = [];
    const walk = async (directory: string): Promise<void> => {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const location = path.join(directory, entry.name);
        if (entry.isDirectory()) await walk(location);
        else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") && !["allowance.ts", "milestones.ts"].includes(entry.name)) {
          const source = await fs.readFile(location, "utf8");
          if (/\b\d+ (free )?(AI )?explanations\b/i.test(source)) offenders.push(path.relative(srcRoot, location));
        }
      }
    };
    await walk(srcRoot);
    assert.deepEqual(offenders, []);
  });
});
