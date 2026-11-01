import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BetaDownloadsPage from "@/app/beta/page";
import AboutPage from "@/app/about/page";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { faqItems } from "@/data/faq";
import { FREE_USE_NOTE } from "@/emails/betaShared";
import { ALLOWANCE } from "./allowance";

Object.assign(globalThis, { React });

const srcRoot = fileURLToPath(new URL("..", import.meta.url));
const text = (element: React.ReactElement) => renderToStaticMarkup(element).replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const VAGUE = /usage limit|usage allowance|monthly limit|free allowance|More explanations each month/i;

describe("explanation allowances", () => {
  it("match the numbers the product enforces", () => {
    assert.deepEqual(ALLOWANCE, { trialExplanations: 50, trialTestMe: 50, trialDays: 30, freeMonthly: 50, proMonthly: 100 });
  });

  it("/pricing states signed out, Free and Pro numbers", () => {
    for (const paymentsOpen of [false, true]) {
      const page = text(createElement(PricingPlans, { paymentsOpen }));
      assert.match(page, /50 explanations in your first 30 days without signing in, then 50 explanations a month when you sign in\./);
      assert.match(page, /100 explanations a month/);
      assert.doesNotMatch(page, VAGUE);
    }
  });

  it("/beta states the trial and the Free month", () => {
    const page = text(createElement(BetaDownloadsPage));
    assert.match(page, /you get 50 explanations \(follow-up questions count toward these\) and 50 Test me questions in your first 30 days\. Signing in gives you 50 explanations a month on Free/);
    assert.doesNotMatch(page, VAGUE);
  });

  it("the FAQ, /about and the download email say the same", () => {
    const free = faqItems.find((item) => item.id === "free")?.answer ?? "";
    assert.match(free, /50 explanations in your first 30 days without signing in, then 50 explanations a month when you sign in\./);
    const about = text(createElement(AboutPage));
    assert.match(about, /Free: 50 explanations in your first 30 days without signing in, then 50 explanations a month when you sign in\./);
    assert.equal(FREE_USE_NOTE, "Without an account you get 50 explanations (follow-up questions count toward these) and 50 Test me questions in your first 30 days. Sign in for 50 explanations a month on Free.");
    for (const copy of [free, about, FREE_USE_NOTE]) assert.doesNotMatch(copy, VAGUE);
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
