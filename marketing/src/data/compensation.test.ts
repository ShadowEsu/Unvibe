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
  supportRows,
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
  ["Mixpanel for Startups", "2026-08-18", undefined],
  ["PostHog for Startups", "2026-08-17", 50_000],
  ["Salesforce Launchpad", "2026-08-26", undefined],
  ["Google for Startups", "2026-08-20", undefined],
  ["Deepgram Startup Program", "2026-08-19", undefined],
  ["MongoDB for Startups", "2026-07-21", undefined],
];
/** Programs with terms on record but no amount (Security 0208 end): shown by name and terms, never with a figure. */
const NO_AMOUNT_TERMS: Array<[string, string]> = [
  ["Mixpanel for Startups", "First year free on the Startup Plan"],
  ["Salesforce Launchpad", "Starter Suite free for 12 months, then 50% off the second year"],
  ["Google for Startups", "Program member"],
  ["Deepgram Startup Program", "Program member"],
  ["MongoDB for Startups", "Program member"],
];
const HERO = "$72,300 in Claude and PostHog credits and committed cash · 7 programs, including Claude for Startups";
const SUMMARY =
  "In Claude for Startups, plus Mixpanel, PostHog, Salesforce Launchpad, Google for Startups, Deepgram and MongoDB®";
/** Program lines and amounts Security removed for lack of a record (0208): never shown again anywhere. */
const REMOVED =
  /gitlab|linear startup pack|linear's startup pack|openai for startups|chatgpt business|\$23,700|\$4,500|\$1,200|\$144,000|\$13,500|deepgram \$1,000|\$1,000 in deepgram|\$2,000 in google cloud|\$500 in program credits/i;
/** CL-T1: the total is never presented as the value of every program. */
const ALL_PROGRAMS_TOTAL = /startup-program credits and committed cash|credits from \d+ startup programs|program credits plus self-reported cash/i;
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
    assert.deepEqual(startupPrograms.filter((program) => program.amountUsd === undefined).map((program) => [program.program, program.detail]), NO_AMOUNT_TERMS);
    assert.deepEqual(PROGRAM_NOTICES, [SALESFORCE_ATTRIBUTION]);
    assert.equal(startupProgramsLine(), SUMMARY);
    assert.deepEqual(startupPrograms.filter((program) => program.logo).map((program) => [program.brand, program.logo?.src]), [["MongoDB", LOGO]]);
  });

  it("adds up: $71,500 of Claude and PostHog credits + $800 of cash = $72,300, from the amounts shown", () => {
    const shown = PROGRAMS.reduce((sum, [, , amount]) => sum + (amount ?? 0), 0);
    assert.equal(shown, 71_500);
    assert.equal(compensationCreditsUsd(), shown);
    assert.equal(compensationCashUsd(), 800);
    assert.equal(compensationTotalUsd(), compensationCreditsUsd() + compensationCashUsd());
    assert.equal(compensationTotalUsd(), 72_300);
    assert.equal(compensationTotalLabel(), "$72,300");
    // Two programs with an amount on record, plus the two cash lines; the other five have no money line.
    assert.deepEqual(compensationLines.map((line) => [line.name, line.amountUsd]), [
      ["Claude for Startups", 21_500],
      ["PostHog for Startups", 50_000],
      ["Own capital", 500],
      ["Early angel support", 300],
    ]);
    assert.equal(compensationLines.reduce((sum, line) => sum + line.amountUsd, 0), 72_300);
    assert.deepEqual(supportRows().map((row) => [row.name, row.amount]), [
      ["PostHog for Startups", "$50,000"],
      ["Claude for Startups", "$21,500"],
      ["Own capital", "$500"],
      ["Early angel support", "$300"],
      ...NO_AMOUNT_TERMS.map(([name]): [string, string] => [name, "No amount"]),
    ]);
  });

  it("never publishes AWS, or wording that reads as sponsorship: no line, program, milestone or kit text", () => {
    assert.equal(compensationLines.some((line) => /aws/i.test(`${line.name} ${line.detail}`)), false);
    for (const [what, data] of [["programs", JSON.stringify(startupPrograms)], ["lines", JSON.stringify(compensationLines)], ["milestones", JSON.stringify(milestones)], ["kit", kitMarkdown()]]) {
      assert.doesNotMatch(data, NO_AWS, what);
      assert.doesNotMatch(data, SPONSOR_READING, what);
      assert.doesNotMatch(data, REMOVED, what);
      assert.doesNotMatch(data, ALL_PROGRAMS_TOTAL, what);
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
    assert.doesNotMatch(text(home), ALL_PROGRAMS_TOTAL);
  });

  it("/investors shows the total tied to its sources, the count, the 7 names in #backing and every source with its amount or terms", () => {
    const page = render(InvestorsPage);
    assertProgramSection(section(page, /<section class="inv-section" id="backing"/), "/investors#backing");
    const words = text(page);
    assert.match(words, /\$72,300 in Claude and PostHog credits and committed cash/);
    assert.match(words, /7 startup programs we're in/);
    assert.match(words, /Claude and PostHog credits \$71,500 · cash \$800\. The other 5 programs are listed with their terms and no amount\./);
    for (const row of supportRows()) assert.ok(words.includes(`${row.name} ${row.amount} ${row.detail}`), row.name);
    assert.doesNotMatch(words, ALL_PROGRAMS_TOTAL);
    assertMarksAtFirstUse(page, "/investors");
    assert.doesNotMatch(words, NO_AWS);
    assert.doesNotMatch(words, SPONSOR_READING);
  });

  it("/about shows the total with the count, the summary, the 7 names and the investors link", () => {
    const page = render(AboutPage);
    const block = section(page, /<section class="paper-wrap about-backing"/);
    assertProgramSection(block, "/about");
    assert.match(text(block), /Startup programs we're in \$72,300 in Claude and PostHog credits and committed cash, plus 5 more startup programs listed without an amount\./);
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
    const programMilestones = company.filter((m) => PROGRAMS.some(([name]) => m.title.replace(/[™®]/g, "").includes(name)) || m.title === "Claude and PostHog credits and committed cash");
    assert.equal(programMilestones.length, 8);
    for (const m of programMilestones) assert.doesNotMatch(`${m.title} ${m.summary}`, BANNED_WORDING, m.title);
    for (const m of milestones) assert.doesNotMatch(`${m.title} ${m.summary}`, RETIRED_NAMES, m.title);
    assert.ok(milestones.find((m) => m.title === "Salesforce Launchpad")?.summary.includes(SALESFORCE_ATTRIBUTION));
    for (const [name] of NO_AMOUNT_TERMS) {
      const found = company.find((m) => m.title.replace(/[™®]/g, "") === name);
      assert.equal(found?.figure, undefined, name);
      assert.doesNotMatch(found?.summary ?? "", /\$/, name);
    }
    assert.equal(milestones.find((m) => m.title === "Claude and PostHog credits and committed cash")?.figure, "$72,300");
  });

  it("the kit names the programs with the notices and the marks", () => {
    const kit = kitMarkdown();
    assert.ok(kit.includes(SUMMARY));
    assert.ok(kit.includes(SALESFORCE_ATTRIBUTION));
    assertMarksAtFirstUse(kit, "kit");
    assert.doesNotMatch(kit, RETIRED_NAMES);
    assert.ok(kit.includes("Support secured with an amount on record: $72,300, of which $71,500 is Claude and PostHog credits and $800 is committed cash. Unvibe is in 7 startup programs; 5 of them are listed with their terms and no amount, so never add a figure for them."));
    const investors = kit.slice(kit.indexOf(SUMMARY) - 200, kit.indexOf(SUMMARY) + SUMMARY.length + 400);
    assert.doesNotMatch(investors.replace(/nothing stronger.*$/m, ""), BANNED_WORDING);
  });
});
