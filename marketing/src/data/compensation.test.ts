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
  PROGRAM_NOTICES,
  SALESFORCE_ATTRIBUTION,
  startupPrograms,
  startupProgramsLine,
} from "./compensation";
import { milestones } from "./milestones";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

/**
 * Every program the earlier site listed except AWS (Preston, ledger 317), minus what the record does not support
 * (Security 31 Oct, requests/security/20261031-0208): name, date, credit value (none where no amount is supported).
 */
const PROGRAMS: Array<[string, string, number | undefined]> = [
  ["Claude for Startups", "2026-10-07", 21_500],
  ["Mixpanel for Startups", "2026-08-18", 144_000],
  ["PostHog for Startups", "2026-08-17", 50_000],
  ["Salesforce Launchpad", "2026-08-26", 13_500],
  ["Google for Startups", "2026-07-23", undefined],
  ["Deepgram Startup Program", "2026-08-19", undefined],
  ["MongoDB for Startups", "2026-07-21", 500],
];
const HERO = "$230,300 in startup-program credits and committed cash · 7 programs, including Claude for Startups";
const SUMMARY =
  "In Claude for Startups, plus Mixpanel, PostHog, Salesforce Launchpad, Google for Startups, Deepgram and MongoDB®";
/** Program lines Security removed for lack of a record (0208): never shown again anywhere. */
const REMOVED =
  /gitlab|linear startup pack|linear's startup pack|openai for startups|chatgpt business|\$23,700|\$4,500|\$1,200|deepgram \$1,000|\$1,000 in deepgram|\$2,000 in google cloud/i;
/**
 * MongoDB's logo as served on mongodb.com/company/newsroom/brand-resources, unmodified: the only logo Security
 * cleared. The other six programs are text (PolyForm Strict, no published permission, or "ask first").
 */
const LOGO = "/sponsors/mongodb-logo.svg";
const LOGO_SHA256 = "9f5435c8be18a834b2c2f8c4c03f117a997646c660fd6f28e3b6869a1bc2fcc1";
const NO_AWS = /\baws\b|amazon web services/i;
const BANNED_WORDING = /\bpartner(s|ship)?\b|backed by|supported by|\bofficial\b|in partnership with|trusted by|\bsponsor(s|ed|ship)?\b/i;
/**
 * Wording that read as brands sponsoring us (Security W-1, W-2): checked on every whole page, the data, the
 * milestones and the kit. The $800 is our own and angel cash, so the total is "credits and committed cash".
 */
const SPONSOR_READING = /supported by|startup support/i;
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

/** The 7 names, the one MongoDB logo and nothing else, the notice, no removed line, no "$0", no AWS and no banned wording. */
function assertProgramSection(markup: string, where: string) {
  const words = text(markup);
  for (const [name] of PROGRAMS) {
    assert.match(words, new RegExp(name.replace(/^MongoDB/, "MongoDB[®]?")), `${where}: ${name}`);
  }
  const images = Array.from(markup.matchAll(/<img\b[^>]*>/g), ([tag]) => tag);
  assert.deepEqual(images.map((tag) => tag.match(/\bsrc="([^"]+)"/)?.[1]), [LOGO], `${where}: the one logo is MongoDB's`);
  assert.match(images[0], /\balt="MongoDB"/, `${where}: MongoDB logo alt`);
  assert.doesNotMatch(markup, /<svg\b|<picture\b|background-image|\/sponsors\/(?!mongodb-logo\.svg)/i, `${where}: no other logo`);
  assert.ok(words.includes(SALESFORCE_ATTRIBUTION), `${where}: Salesforce attribution`);
  assert.doesNotMatch(words, REMOVED, `${where}: removed programs`);
  assert.doesNotMatch(words, /\$0\b/, `${where}: a program without an amount never shows $0`);
  assert.doesNotMatch(words, NO_AWS, where);
  assert.doesNotMatch(words, BANNED_WORDING, where);
  assert.doesNotMatch(words, RETIRED_NAMES, where);
}

/** MongoDB Standard 3: the first use of the name on a page carries its notice. */
function assertMarksAtFirstUse(markup: string, where: string) {
  const words = text(markup);
  for (const [name, symbol] of [["MongoDB", "®"]]) {
    const first = words.indexOf(name);
    assert.ok(first >= 0, `${where} names ${name}`);
    assert.equal(words.slice(first, first + name.length + 1), `${name}${symbol}`, `${where}: first ${name} is ${name}${symbol}`);
  }
}

describe("startup programs", () => {
  it("lists every program the earlier site listed except AWS, with its date and credit value", () => {
    assert.deepEqual(startupPrograms.map((program) => [program.program, program.accepted, program.amountUsd]), PROGRAMS);
    assert.equal(compensationProgramCount(), 7);
    assert.deepEqual(PROGRAM_NOTICES, [SALESFORCE_ATTRIBUTION]);
    assert.equal(startupProgramsLine(), SUMMARY);
    assert.deepEqual(startupPrograms.filter((program) => program.logo).map((program) => [program.brand, program.logo?.src]), [["MongoDB", LOGO]]);
  });

  it("adds up: $229,500 of program credits + $800 of cash = $230,300, from the amounts shown", () => {
    const shown = PROGRAMS.reduce((sum, [, , amount]) => sum + (amount ?? 0), 0);
    assert.equal(shown, 229_500);
    assert.equal(compensationCreditsUsd(), shown);
    assert.equal(compensationCashUsd(), 800);
    assert.equal(compensationTotalUsd(), compensationCreditsUsd() + compensationCashUsd());
    assert.equal(compensationTotalUsd(), 230_300);
    assert.equal(compensationTotalLabel(), "$230,300");
    // Five programs with a supported amount, plus the two cash lines; Google and Deepgram have no money line.
    assert.equal(compensationLines.length, 7);
    assert.equal(compensationLines.some((line) => /deepgram|google/i.test(line.name)), false);
    assert.equal(compensationLines.reduce((sum, line) => sum + line.amountUsd, 0), 230_300);
  });

  it("never publishes AWS, or wording that reads as sponsorship: no line, program, milestone or kit text", () => {
    assert.equal(compensationLines.some((line) => /aws/i.test(`${line.name} ${line.detail}`)), false);
    for (const [what, data] of [["programs", JSON.stringify(startupPrograms)], ["lines", JSON.stringify(compensationLines)], ["milestones", JSON.stringify(milestones)], ["kit", kitMarkdown()]]) {
      assert.doesNotMatch(data, NO_AWS, what);
      assert.doesNotMatch(data, SPONSOR_READING, what);
      assert.doesNotMatch(data, REMOVED, what);
    }
    // Text fields only: the logo path is /sponsors/…, which is a folder name, not copy.
    for (const program of startupPrograms) assert.doesNotMatch(`${program.brand} ${program.program} ${program.detail}`, BANNED_WORDING);
    for (const line of compensationLines) assert.doesNotMatch(`${line.name} ${line.detail}`, BANNED_WORDING);
  });

  it("ships only MongoDB's logo file, unmodified", () => {
    const dir = join(process.cwd(), "public/sponsors");
    assert.deepEqual(readdirSync(dir), ["mongodb-logo.svg"]);
    assert.equal(createHash("sha256").update(readFileSync(join(dir, "mongodb-logo.svg"))).digest("hex"), LOGO_SHA256);
  });

  it("home: the hero line links to /investors#backing, and the strip shows the 7 names and only the MongoDB logo", () => {
    const home = render(HomePage);
    const hero = home.match(/<p class="vhero__backing">([\s\S]*?)<\/p>/)?.[1] ?? "";
    assert.match(hero, /<a href="\/investors#backing">/);
    assert.equal(Array.from(hero.matchAll(/<a\b/g)).length, 1, "the programs line stays one tab stop");
    assert.equal(text(hero).trim(), HERO);
    const strip = section(home, /<section id="backing"/);
    assertProgramSection(strip, "home strip");
    assert.match(text(strip), /Unvibe is in Claude for Startups\./);
    assertMarksAtFirstUse(home, "home");
    assert.match(text(strip), /Startup programs we're in\./);
    assert.doesNotMatch(text(home), SPONSOR_READING);
  });

  it("/investors shows the total, the count, the 7 names in #backing and every line with its amount", () => {
    const page = render(InvestorsPage);
    assertProgramSection(section(page, /<section class="inv-section" id="backing"/), "/investors#backing");
    const words = text(page);
    assert.match(words, /\$230,300 in startup-program credits and committed cash/);
    assert.match(words, /7 startup programs we're in/);
    assert.match(words, /Program credits \$229,500 · cash \$800/);
    for (const line of compensationLines) assert.ok(words.includes(`${line.name} ${formatUsd(line.amountUsd)}`), line.name);
    assertMarksAtFirstUse(page, "/investors");
    assert.doesNotMatch(words, NO_AWS);
    assert.doesNotMatch(words, SPONSOR_READING);
  });

  it("/about shows the total with the count, the summary, the 7 names and the investors link", () => {
    const page = render(AboutPage);
    const block = section(page, /<section class="paper-wrap about-backing"/);
    assertProgramSection(block, "/about");
    assert.match(text(block), /Startup programs we're in \$230,300 in startup-program credits and committed cash \(7 programs\)\./);
    assert.ok(text(block).includes(`${SUMMARY}.`));
    assert.match(block, /<a href="\/investors#backing">More on the investors page\.<\/a>/);
    assertMarksAtFirstUse(page, "/about");
    assert.doesNotMatch(text(page), NO_AWS);
    assert.doesNotMatch(text(page), SPONSOR_READING);
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
    const programMilestones = company.filter((m) => PROGRAMS.some(([name]) => m.title.replace(/[™®]/g, "").includes(name)) || m.title === "Startup-program credits and committed cash");
    assert.equal(programMilestones.length, 8);
    for (const m of programMilestones) assert.doesNotMatch(`${m.title} ${m.summary}`, BANNED_WORDING, m.title);
    for (const m of milestones) assert.doesNotMatch(`${m.title} ${m.summary}`, RETIRED_NAMES, m.title);
    assert.ok(milestones.find((m) => m.title === "Salesforce Launchpad")?.summary.includes(SALESFORCE_ATTRIBUTION));
    for (const title of ["Deepgram Startup Program", "Google for Startups"]) {
      const found = milestones.find((m) => m.title === title);
      assert.equal(found?.figure, undefined, title);
      assert.doesNotMatch(found?.summary ?? "", /\$/, title);
    }
    assert.equal(milestones.find((m) => m.title === "Startup-program credits and committed cash")?.figure, "$230,300");
  });

  it("the kit names the programs with the notices and the marks", () => {
    const kit = kitMarkdown();
    assert.ok(kit.includes(SUMMARY));
    assert.ok(kit.includes(SALESFORCE_ATTRIBUTION));
    assertMarksAtFirstUse(kit, "kit");
    assert.doesNotMatch(kit, RETIRED_NAMES);
    const investors = kit.slice(kit.indexOf(SUMMARY) - 200, kit.indexOf(SUMMARY) + SUMMARY.length + 400);
    assert.doesNotMatch(investors.replace(/nothing stronger.*$/m, ""), BANNED_WORDING);
  });
});
