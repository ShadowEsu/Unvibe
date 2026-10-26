import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sitemap from "@/app/sitemap";
import { TryIt } from "@/components/paper/TryIt";
import { EXPLAIN_PATHS, explainLanguage, explainPages } from "./explainPages";
import { languages } from "./languages";

// tsx compiles the components' JSX to React.createElement (tsconfig has jsx: preserve for Next),
// so rendering them here needs React in scope.
Object.assign(globalThis, { React });

// What the home page has always preloaded. If this fails, the home Try it box changed.
const HOME_SAMPLE = `function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}`;

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&amp;": "&" };

/** The text a rendered Try it box opens with, as the visitor sees it. */
function textareaText(html: string): string | undefined {
  return /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(html)?.[1]?.replace(/&(lt|gt|quot|#x27|amp);/g, (entity) => ENTITIES[entity] ?? entity);
}

describe("explain pages", () => {
  it("each has a unique id that is a language in languages.ts", () => {
    const ids = explainPages.map((page) => page.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.join(", ")}`);
    for (const page of explainPages) {
      assert.match(page.id, /^[a-z0-9-]+$/, page.id);
      assert.ok(languages.some((language) => language.id === page.id), `${page.id} is not in languages.ts`);
    }
  });

  it("each sample fits the Try it box and the public demo's limits", () => {
    const limit = Number(/<textarea[^>]*maxLength="(\d+)"/i.exec(renderToStaticMarkup(createElement(TryIt)))?.[1]);
    assert.equal(limit, 1500);
    for (const page of explainPages) {
      const lines = page.sample.split("\n");
      assert.ok(page.sample.trim().length > 0, `${page.id}: empty sample`);
      assert.ok(page.sample.length <= limit, `${page.id}: ${page.sample.length} characters, the box takes ${limit}`);
      assert.ok(lines.length >= 8 && lines.length <= 25, `${page.id}: ${lines.length} lines, want 8 to 25 (the demo takes up to 60)`);
      assert.equal(page.sample, page.sample.trim(), `${page.id}: leading or trailing blank lines`);
    }
  });

  it("are not near copies of each other", () => {
    for (const field of ["sample", "lead", "description", "sampleSummary", "fileName", "watchOut"] as const) {
      const values = explainPages.map((page) => page[field]);
      assert.equal(new Set(values).size, values.length, `two pages share a ${field}`);
    }
    const notes = explainPages.flatMap((page) => [...page.notes, ...page.shows.map((shown) => shown.text)]);
    assert.equal(new Set(notes).size, notes.length, "two pages share a note");
  });

  it("only claim concepts the language lists, at least two per page", () => {
    for (const page of explainPages) {
      const { concepts } = explainLanguage(page);
      assert.ok(page.shows.length >= 2, `${page.id}: shows ${page.shows.length} concepts`);
      for (const { concept } of page.shows) assert.ok(concepts.includes(concept), `${page.id}: "${concept}" is not in its concepts`);
    }
  });

  it("close every `code` span in the copy", () => {
    for (const page of explainPages) {
      for (const text of [page.lead, page.description, page.sampleSummary, page.watchOut, ...page.notes, ...page.shows.map((shown) => shown.text)]) {
        assert.equal(text.split("`").length % 2, 1, `${page.id}: unbalanced backtick in "${text}"`);
      }
    }
  });

  it("are all in the sitemap, once each", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    assert.deepEqual(EXPLAIN_PATHS, ["/explain", ...explainPages.map((page) => `/explain/${page.id}`)]);
    for (const path of EXPLAIN_PATHS) assert.equal(urls.filter((url) => url === path).length, 1, `${path} in the sitemap`);
  });
});

describe("the Try it box", () => {
  it("still opens on the home page's debounce sample with no props", () => {
    const html = renderToStaticMarkup(createElement(TryIt));
    assert.equal(textareaText(html), HOME_SAMPLE);
    assert.match(html, /<span>your-code\.js<\/span>/);
  });

  it("opens on the sample and file name a page passes", () => {
    for (const page of explainPages) {
      const html = renderToStaticMarkup(createElement(TryIt, { sample: page.sample, fileName: page.fileName }));
      assert.equal(textareaText(html), page.sample, page.id);
      assert.ok(html.includes(`<span>${page.fileName}</span>`), page.id);
    }
  });
});
