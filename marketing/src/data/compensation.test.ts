import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";
import AboutPage from "@/app/about/page";
import InvestorsPage from "@/app/investors/page";
import { kitMarkdown } from "@/lib/kit";
import * as compensation from "./compensation";
import {
  compensationLines,
  compensationTotalLabel,
  compensationTotalUsd,
  SALESFORCE_ATTRIBUTION,
  startupPrograms,
  startupProgramsLine,
} from "./compensation";
import { milestones } from "./milestones";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

/** The acceptance emails (BOSS inbox check, 28 Oct 2026): full program name and date. */
const PROGRAMS = [
  ["PostHog for Startups", "2026-08-17"],
  ["Mixpanel for Startups", "2026-08-18"],
  ["Salesforce Launchpad", "2026-08-26"],
  ["Deepgram Startup Program", "2026-08-19"],
  ["MongoDB for Startups", "2026-07-21"],
];
const HEADLINE = "In 5 startup programs: PostHog, Mixpanel, Salesforce Launchpad, Deepgram and MongoDB®";
/**
 * MongoDB's logo as served on mongodb.com/company/newsroom/brand-resources, unmodified. The only logo allowed:
 * PostHog's brand files are PolyForm Strict (no commercial use), the others grant no logo use.
 */
const LOGO = "/sponsors/mongodb-logo.svg";
const LOGO_SHA256 = "9f5435c8be18a834b2c2f8c4c03f117a997646c660fd6f28e3b6869a1bc2fcc1";
/** Programs that are not ours to name (rejected, or no acceptance email), and any money figure for programs. */
const NOT_OURS = /claude for startups|anthropic|\baws\b|activate credits|gitlab|openai|linear founder|linear startup|google ai startups|google cloud|salesforce for startups|\$262,700|\$261,900|\$144,000|\$50,000|\$21\.5K|\$23,700|\$13,500/i;
const BANNED_WORDING = /\bpartner(s|ship)?\b|backed by|\bofficial\b|in partnership with|trusted by/i;

const render = (page: () => React.ReactNode) => renderToStaticMarkup(createElement(page)).replace(/\s+/g, " ");

function section(markup: string, opening: RegExp): string {
  const start = markup.search(opening);
  assert.ok(start >= 0, `section ${opening} is on the page`);
  const end = markup.indexOf("</section>", start);
  return markup.slice(start, end + "</section>".length);
}

/** Exactly the 5 names, the one MongoDB logo and nothing else, and Salesforce's attribution. */
function assertProgramSection(markup: string, where: string) {
  for (const [name] of PROGRAMS) {
    const shown = name.replace("MongoDB", "MongoDB(®)?");
    assert.match(markup, new RegExp(shown), `${where}: ${name}`);
  }
  const images = Array.from(markup.matchAll(/<img\b[^>]*>/g), ([tag]) => tag);
  assert.deepEqual(images.map((tag) => tag.match(/\bsrc="([^"]+)"/)?.[1]), [LOGO], `${where}: the one logo is MongoDB's`);
  assert.match(images[0], /\balt="MongoDB"/, `${where}: MongoDB logo alt`);
  assert.doesNotMatch(markup, /<svg\b|<picture\b|background-image|\/sponsors\/(?!mongodb-logo\.svg)/i, `${where}: no other logo`);
  assert.ok(markup.includes(SALESFORCE_ATTRIBUTION), `${where}: Salesforce attribution`);
  assert.doesNotMatch(markup, NOT_OURS, where);
  assert.doesNotMatch(markup, BANNED_WORDING, where);
}

/** MongoDB Trademark Standard 3: the first use of the name in each page's text carries ®. */
function assertMongoRegisteredAtFirstUse(page: string, where: string) {
  const text = page.replace(/<[^>]+>/g, " ");
  const first = text.indexOf("MongoDB");
  assert.ok(first >= 0, `${where} names MongoDB`);
  assert.equal(text.slice(first, first + 8), "MongoDB®", `${where}: first MongoDB is MongoDB®`);
}

describe("compensation", () => {
  it("sums the public self-reported cash lines", () => {
    assert.equal(compensationLines.length, 2);
    assert.ok(compensationLines.every((line) => line.kind === "cash"));
    assert.equal(compensationLines.reduce((sum, line) => sum + line.amountUsd, 0), 800);
    assert.equal(compensationTotalUsd(), 800);
    assert.equal(compensationTotalLabel(), "$800");
  });

  it("keeps program names out of the cash lines", () => {
    const programs = /anthropic|claude|mixpanel|posthog|salesforce|gitlab|linear|google|openai|deepgram|mongodb|aws/i;
    assert.equal(compensationLines.some((line) => programs.test(`${line.name} ${line.detail}`)), false);
  });
});

describe("startup programs", () => {
  it("lists exactly the 5 programs with acceptance emails, by full name and date, with no amounts", () => {
    assert.deepEqual(startupPrograms.map((program) => [program.program, program.accepted]), PROGRAMS);
    assert.deepEqual(startupPrograms.map((program) => program.brand), ["PostHog", "Mixpanel", "Salesforce Launchpad", "Deepgram", "MongoDB"]);
    assert.deepEqual(startupPrograms.filter((program) => program.logo).map((program) => [program.brand, program.logo]), [["MongoDB", LOGO]]);
    for (const program of startupPrograms) {
      assert.deepEqual(Object.keys(program).filter((key) => !["brand", "program", "accepted", "logo", "registered"].includes(key)), [], program.program);
    }
    assert.equal(startupProgramsLine(), HEADLINE);
  });

  it("exports no program credit or support total", () => {
    for (const name of Object.keys(compensation)) assert.doesNotMatch(name, /credit|programCount|support/i, name);
  });

  it("ships only MongoDB's logo file, unmodified", () => {
    const dir = join(process.cwd(), "public/sponsors");
    assert.deepEqual(readdirSync(dir), ["mongodb-logo.svg"]);
    assert.equal(createHash("sha256").update(readFileSync(join(dir, "mongodb-logo.svg"))).digest("hex"), LOGO_SHA256);
  });

  it("home: the hero line links to /investors#backing, and the strip shows the 5 names and only the MongoDB logo", () => {
    const home = render(HomePage);
    const hero = section(home.replace(/<p class="vhero__backing">([\s\S]*?)<\/p>/, '<section class="hero-line">$1</section>'), /<section class="hero-line">/);
    assert.ok(hero.includes(`<a href="/investors#backing">${HEADLINE}</a>`), hero);
    assert.ok(hero.includes(SALESFORCE_ATTRIBUTION), "hero: Salesforce attribution");
    assertProgramSection(section(home, /<section id="backing"/), "home strip");
    assertMongoRegisteredAtFirstUse(home, "home");
  });

  it("/investors#backing shows the 5 names, only the MongoDB logo, and no program amounts or total", () => {
    const page = render(InvestorsPage);
    assertProgramSection(section(page, /<section class="inv-section" id="backing"/), "/investors#backing");
    assertMongoRegisteredAtFirstUse(page, "/investors");
    assert.doesNotMatch(page, NOT_OURS);
  });

  it("/about shows the 5 names, only the MongoDB logo, and the link to every line", () => {
    const page = render(AboutPage);
    const block = section(page, /<section class="paper-wrap about-backing"/);
    assertProgramSection(block, "/about");
    assert.match(block, /<a href="\/investors#backing">Every line is on the investors page\.<\/a>/);
    assertMongoRegisteredAtFirstUse(page, "/about");
    assert.doesNotMatch(page, NOT_OURS);
  });

  it("the milestones name exactly these 5 programs, on their acceptance dates, with no amounts", () => {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const iso = (date: string) => {
      const [day, month, year] = date.split(" ");
      return `${year}-${String(months.indexOf(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
    };
    const entries = milestones
      .filter((m) => /for startups|launchpad|startup program/i.test(m.title))
      .map((m) => [m.title.replace("®", ""), iso(m.date)])
      .sort();
    assert.deepEqual(entries, [...PROGRAMS].sort());
    for (const m of milestones) assert.doesNotMatch(`${m.title} ${m.summary} ${m.figure ?? ""}`, NOT_OURS, m.title);
    const salesforce = milestones.find((m) => m.title === "Salesforce Launchpad");
    assert.ok(salesforce?.summary.includes(SALESFORCE_ATTRIBUTION));
  });

  it("the kit names the programs with Salesforce's attribution and no amounts", () => {
    const kit = kitMarkdown();
    assert.ok(kit.includes(HEADLINE));
    assert.ok(kit.includes(SALESFORCE_ATTRIBUTION));
    assert.doesNotMatch(kit, NOT_OURS);
  });
});
