import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import manifest from "./manifest";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));
const site = "https://unvibe.site";

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): string {
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString("latin1"), "PNG", `${file} is not a PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("web app manifest", () => {
  const m = manifest();

  it("opens /explain in its own window, inside the site", () => {
    assert.equal(m.display, "standalone");
    assert.equal(m.name, "Unvibe");
    for (const url of [m.start_url, m.scope, m.id]) {
      assert.ok(url?.startsWith("/"), `${url} is not same-origin`);
      assert.equal(new URL(url ?? "", site).origin, site);
    }
    assert.equal(new URL(m.start_url ?? "", site).pathname, "/explain");
    assert.ok(new URL(m.start_url ?? "", site).pathname.startsWith(m.scope ?? "?"), "start_url is outside scope");
  });

  it("lists a 192 and a 512 icon for any purpose, each a PNG of that size on disk", () => {
    const icons = m.icons ?? [];
    for (const size of ["192x192", "512x512"]) {
      assert.ok(icons.some((icon) => icon.sizes === size && (icon.purpose ?? "any") === "any"), `no ${size} icon for any purpose`);
    }
    for (const icon of icons) {
      assert.equal(icon.type, "image/png");
      assert.equal(pngSize(`${publicDir}${icon.src}`), icon.sizes, icon.src);
    }
  });
});
