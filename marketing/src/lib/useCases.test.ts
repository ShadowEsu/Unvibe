import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import sitemap from "@/app/sitemap";
import { explainPages } from "@/lib/explainPages";
import { USE_CASE_PATHS, USE_CASES_INDEX, pathForUseCase, useCases } from "@/lib/useCases";

const appDir = path.resolve("src/app/use-cases");
const sources = [
  path.join(appDir, "page.tsx"),
  ...useCases.map(({ slug }) => path.join(appDir, slug, "page.tsx")),
  path.resolve("src/components/paper/UseCaseParts.tsx"),
  path.resolve("src/lib/useCases.ts"),
];

describe("use-case pages", () => {
  it("each has its own folder under src/app/use-cases, and no folder is left without an entry", () => {
    const folders = readdirSync(appDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => name).sort();
    assert.deepEqual(folders, useCases.map(({ slug }) => slug).sort());
  });

  it("are all in the sitemap, once each", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    assert.deepEqual(USE_CASE_PATHS, [USE_CASES_INDEX.path, ...useCases.map(pathForUseCase)]);
    for (const route of USE_CASE_PATHS) assert.equal(urls.filter((url) => url === route).length, 1, `${route} in the sitemap`);
  });

  it("each names an explain page that exists, so the links both ways resolve", () => {
    const ids = new Set(explainPages.map(({ id }) => id));
    for (const { slug, explainId } of useCases) assert.ok(ids.has(explainId), `${slug}: no /explain/${explainId}`);
  });

  it("have unique titles under 60 characters as shown and unique descriptions under 155", () => {
    const shown = [USE_CASES_INDEX.title, ...useCases.map(({ title }) => `${title} · Unvibe`)];
    const descriptions = [USE_CASES_INDEX.description, ...useCases.map(({ description }) => description)];
    assert.equal(new Set(shown).size, shown.length);
    assert.equal(new Set(descriptions).size, descriptions.length);
    for (const title of shown) assert.ok(title.length <= 60, `${title.length} characters: ${title}`);
    for (const description of descriptions) assert.ok(description.length <= 155, `${description.length} characters: ${description}`);
  });

  it("use no dashes in sentences and no italics", () => {
    for (const file of sources) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /[\u2013\u2014]/, `${file}: en or em dash`);
      assert.doesNotMatch(text, /<(em|i)[\s>]/, `${file}: italics`);
    }
  });
});
