import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BetaDownloadsPage from "@/app/beta/page";

Object.assign(globalThis, { React });

const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url);

describe("/beta photo band", () => {
  const img = renderToStaticMarkup(createElement(BetaDownloadsPage)).match(/<header class="paper-photo-band[^"]*">\s*<img [^>]+>/)?.[0] ?? "";

  it("loads a crop sized for the band, first", () => {
    assert.match(img, /src="\/hero\/golden-gate-band-1440x420\.webp"/);
    assert.match(img, /srcSet="\/hero\/golden-gate-band-780x545\.webp 780w, \/hero\/golden-gate-band-1440x420\.webp 1440w"/);
    assert.match(img, /fetchpriority="high"/);
    assert.doesNotMatch(img, /golden-gate-band-1600/);
  });

  it("keeps each file at or under 80 KB", () => {
    for (const path of ["/hero/golden-gate-band-1440x420.webp", "/hero/golden-gate-band-780x545.webp"]) {
      assert.ok(statSync(publicFile(path)).size <= 80 * 1024, path);
    }
  });
});
