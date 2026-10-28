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
import {
  compensationCashUsd,
  compensationCreditsUsd,
  compensationLines,
  compensationProgramCount,
  compensationTotalLabel,
  compensationTotalUsd,
  formatUsd,
  GITLAB_ATTRIBUTION,
  SALESFORCE_ATTRIBUTION,
  startupPrograms,
  startupProgramsLine,
} from "./compensation";
import { milestones } from "./milestones";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

/** Every program the earlier site listed except AWS (Preston, ledger 317): name, date, credit value. */
const PROGRAMS: Array<[string, string, number]> = [
  ["Claude for Startups", "2026-10-07", 21_500],
  ["Mixpanel for Startups", "2026-08-18", 144_000],
  ["PostHog for Startups", "2026-08-17", 50_000],
  ["GitLab for Startups", "2026-08-16", 23_700],
  ["Salesforce Launchpad", "2026-08-26", 13_500],
  ["Linear startup pack", "2026-08-14", 4_500],
  ["Google for Startups", "2026-07-23", 2_000],
  ["OpenAI for Startups", "2026-08-16", 1_200],
  ["Deepgram Startup Program", "2026-08-19", 1_000],
  ["MongoDB for Startups", "2026-07-21", 500],
];
const HERO = "$262,700 in startup support · 10 programs, including Claude for Startups";
const SUMMARY =
  "In Claude for Startups, plus Mixpanel, PostHog, GitLab™, Salesforce Launchpad, Linear, Google for Startups, OpenAI, Deepgram and MongoDB®";
/**
 * MongoDB's logo as served on mongodb.com/company/newsroom/brand-resources, unmodified: the only logo Security
 * cleared. The other nine programs are text (PolyForm Strict, no published permission, or "ask first").
 */
const LOGO = "/sponsors/mongodb-logo.svg";
const LOGO_SHA256 = "9f5435c8be18a834b2c2f8c4c03f117a997646c660fd6f28e3b6869a1bc2fcc1";
const NO_AWS = /\baws\b|amazon web services/i;
const BANNED_WORDING = /\bpartner(s|ship)?\b|backed by|\bofficial\b|in partnership with|trusted by|\bsponsor(s|ed|ship)?\b/i;
/** Names the earlier copy used that the rulings replaced. */
const RETIRED_NAMES = /founder value pack|google ai startups|salesforce for startups|linear app\b/i;

const render = (page: () => React.ReactNode) => renderToStaticMarkup(createElement(page)).replace(/\s+/g, " ");
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

function section(markup: string, opening: RegExp): string {
  const start = markup.search(opening);
  assert.ok(start >= 0, `section ${opening} is on the page`);
  const end = markup.indexOf("</section>", start);
  return markup.slice(start, end + "</section>".length);
}

/** The 10 names, the one MongoDB logo and nothing else, both notices, no AWS and no banned wording. */
function assertProgramSection(markup: string, where: string) {
  const words = text(markup);
  for (const [name] of PROGRAMS) {
    assert.match(words, new RegExp(name.replace(/^(GitLab|MongoDB)/, "$1[™®]?")), `${where}: ${name}`);
  }
  const images = Array.from(markup.matchAll(/<img\b[^>]*>/g), ([tag]) => tag);
  assert.deepEqual(images.map((tag) => tag.match(/\bsrc="([^"]+)"/)?.[1]), [LOGO], `${where}: the one logo is MongoDB's`);
  assert.match(images[0], /\balt="MongoDB"/, `${where}: MongoDB logo alt`);
  assert.doesNotMatch(markup, /<svg\b|<picture\b|background-image|\/sponsors\/(?!mongodb-logo\.svg)/i, `${where}: no other logo`);
  assert.ok(words.includes(SALESFORCE_ATTRIBUTION), `${where}: Salesforce attribution`);
  assert.ok(words.includes(GITLAB_ATTRIBUTION), `${where}: GitLab attribution`);
  assert.doesNotMatch(words, NO_AWS, where);
  assert.doesNotMatch(words, BANNED_WORDING, where);
  assert.doesNotMatch(words, RETIRED_NAMES, where);
}

/** MongoDB Standard 3 and GitLab guideline 1.2.2: the first use of each name on a page carries its notice. */
function assertMarksAtFirstUse(markup: string, where: string) {
  const words = text(markup);
  for (const [name, symbol] of [["MongoDB", "®"], ["GitLab", "™"]]) {
    const first = words.indexOf(name);
    assert.ok(first >= 0, `${where} names ${name}`);
    assert.equal(words.slice(first, first + name.length + 1), `${name}${symbol}`, `${where}: first ${name} is ${name}${symbol}`);
  }
}

describe("startup support", () => {
  it("lists every program the earlier site listed except AWS, with its date and credit value", () => {
    assert.deepEqual(startupPrograms.map((program) => [program.program, program.accepted, program.amountUsd]), PROGRAMS);
    assert.equal(compensationProgramCount(), 10);
    assert.equal(startupProgramsLine(), SUMMARY);
    assert.deepEqual(startupPrograms.filter((program) => program.logo).map((program) => [program.brand, program.logo?.src]), [["MongoDB", LOGO]]);
  });

  it("adds up: $261,900 of program credits + $800 of cash = $262,700, from the amounts shown", () => {
    const shown = PROGRAMS.reduce((sum, [, , amount]) => sum + amount, 0);
    assert.equal(shown, 261_900);
    assert.equal(compensationCreditsUsd(), shown);
    assert.equal(compensationCashUsd(), 800);
    assert.equal(compensationTotalUsd(), compensationCreditsUsd() + compensationCashUsd());
    assert.equal(compensationTotalUsd(), 262_700);
    assert.equal(compensationTotalLabel(), "$262,700");
    assert.equal(compensationLines.length, 12);
    assert.equal(compensationLines.reduce((sum, line) => sum + line.amountUsd, 0), 262_700);
  });

  it("never publishes AWS: no line, program, milestone or kit text", () => {
    assert.equal(compensationLines.some((line) => /aws/i.test(`${line.name} ${line.detail}`)), false);
    assert.doesNotMatch(JSON.stringify(startupPrograms), NO_AWS);
    assert.doesNotMatch(JSON.stringify(milestones), NO_AWS);
    assert.doesNotMatch(kitMarkdown(), NO_AWS);
  });

  it("ships only MongoDB's logo file, unmodified", () => {
    const dir = join(process.cwd(), "public/sponsors");
    assert.deepEqual(readdirSync(dir), ["mongodb-logo.svg"]);
    assert.equal(createHash("sha256").update(readFileSync(join(dir, "mongodb-logo.svg"))).digest("hex"), LOGO_SHA256);
  });

  it("home: the hero line links to /investors#backing, and the strip shows the 10 names and only the MongoDB logo", () => {
    const home = render(HomePage);
    const hero = home.match(/<p class="vhero__backing">([\s\S]*?)<\/p>/)?.[1] ?? "";
    assert.match(hero, /<a href="\/investors#backing">/);
    assert.equal(text(hero).trim(), HERO);
    const strip = section(home, /<section id="backing"/);
    assertProgramSection(strip, "home strip");
    assert.match(text(strip), /Unvibe is in Claude for Startups\./);
    assertMarksAtFirstUse(home, "home");
  });

  it("/investors shows the total, the count, the 10 names in #backing and every line with its amount", () => {
    const page = render(InvestorsPage);
    assertProgramSection(section(page, /<section class="inv-section" id="backing"/), "/investors#backing");
    const words = text(page);
    assert.match(words, /\$262,700 startup support secured/);
    assert.match(words, /10 startup programs we're in/);
    assert.match(words, /Program credits \$261,900 · cash \$800/);
    for (const line of compensationLines) assert.ok(words.includes(`${line.name} ${formatUsd(line.amountUsd)}`), line.name);
    assertMarksAtFirstUse(page, "/investors");
    assert.doesNotMatch(words, NO_AWS);
  });

  it("/about shows the total with the count, the summary, the 10 names and the investors link", () => {
    const page = render(AboutPage);
    const block = section(page, /<section class="paper-wrap about-backing"/);
    assertProgramSection(block, "/about");
    assert.match(text(block), /\$262,700 in startup support \(10 programs plus committed cash\)\./);
    assert.ok(text(block).includes(`${SUMMARY}.`));
    assert.match(block, /<a href="\/investors#backing">More on the investors page\.<\/a>/);
    assertMarksAtFirstUse(page, "/about");
    assert.doesNotMatch(text(page), NO_AWS);
  });

  it("the milestones name each program on its date, with the notices and none of the retired names", () => {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const iso = (date: string) => {
      const [day, month, year] = date.split(" ");
      return `${year}-${String(months.indexOf(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
    };
    const company = milestones.filter((m) => m.category === "COMPANY");
    for (const [name, date] of PROGRAMS) {
      const found = company.filter((m) => m.title.replace(/[™®]/g, "").includes(name));
      assert.deepEqual(found.map((m) => iso(m.date)), [date], name);
    }
    const programMilestones = company.filter((m) => PROGRAMS.some(([name]) => m.title.replace(/[™®]/g, "").includes(name)) || m.title === "Startup support total");
    assert.equal(programMilestones.length, 11);
    for (const m of programMilestones) assert.doesNotMatch(`${m.title} ${m.summary}`, BANNED_WORDING, m.title);
    for (const m of milestones) assert.doesNotMatch(`${m.title} ${m.summary}`, RETIRED_NAMES, m.title);
    assert.ok(milestones.find((m) => m.title === "Salesforce Launchpad")?.summary.includes(SALESFORCE_ATTRIBUTION));
    assert.ok(milestones.find((m) => m.title === "GitLab™ for Startups")?.summary.includes(GITLAB_ATTRIBUTION));
    assert.equal(milestones.find((m) => m.title === "Startup support total")?.figure, "$262,700");
  });

  it("the kit names the programs with the notices and the marks", () => {
    const kit = kitMarkdown();
    assert.ok(kit.includes(SUMMARY));
    assert.ok(kit.includes(SALESFORCE_ATTRIBUTION));
    assert.ok(kit.includes(GITLAB_ATTRIBUTION));
    assertMarksAtFirstUse(kit, "kit");
    assert.doesNotMatch(kit, RETIRED_NAMES);
  });
});
