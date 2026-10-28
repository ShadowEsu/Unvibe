import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { explainPages } from "@/lib/explainPages";
import { EXPLAIN_CARD_FILES, OG_CARD_SIZE, OG_CARDS, explainCard, pageMetadata } from "@/lib/pageMeta";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));

/** Width and height from a PNG's IHDR chunk; throws if the file is not a PNG. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(path.join(publicDir, file));
  assert.equal(bytes.subarray(1, 4).toString("latin1"), "PNG", `${file} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("link-preview cards", () => {
  it("every language page has its own card, and every card file exists at 1200x630", () => {
    const files = [...Object.values(OG_CARDS).map(({ file }) => file), ...Object.values(EXPLAIN_CARD_FILES)];
    for (const page of explainPages) {
      assert.ok(EXPLAIN_CARD_FILES[page.id], `/explain/${page.id} has no card of its own`);
    }
    for (const file of files) {
      assert.deepEqual(pngSize(file), OG_CARD_SIZE, file);
    }
  });

  it("a page's og:url, canonical and card agree, and the alt names that page", () => {
    const page = explainPages.find(({ id }) => id === "cpp")!;
    const meta = pageMetadata({ path: "/explain/cpp", title: "Explain C++ code in plain English", description: "d", card: explainCard(page) });
    assert.equal(meta.alternates?.canonical, "/explain/cpp");
    const og = meta.openGraph as { url: string; images: Array<{ url: string; alt: string }> };
    assert.equal(og.url, "/explain/cpp");
    assert.equal(og.images.length, 1);
    assert.equal(og.images[0]?.url, EXPLAIN_CARD_FILES.cpp);
    assert.equal(og.images[0]?.alt, "Explain C++ code in plain English. Free for Mac and Windows.");
    assert.equal((meta.twitter as { card: string }).card, "summary_large_image");
  });

  it("every card file is named for its content, so the year-long immutable cache never serves a stale card", () => {
    const cards = readdirSync(path.join(publicDir, "og"));
    assert.ok(cards.length > 0);
    for (const name of cards) {
      const hash = createHash("sha256").update(readFileSync(path.join(publicDir, "og", name))).digest("hex").slice(0, 8);
      assert.match(name, new RegExp(`-${hash}\\.png$`), `${name}: rename it to end in -${hash}.png`);
    }
  });
});
