// First import: unsets the analytics keys before analytics.ts reads them at load.
import { restoreAnalyticsKeys } from "./testWithoutAnalyticsKeys";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThanksContent, type ThanksState } from "@/components/paper/DownloadThanks";
import { FirstOpenSteps } from "@/components/paper/FirstOpenSteps";
import { BETA_INSTALL_ASSET, BETA_MAC_INTEL_ASSET, BETA_WINDOWS_ASSET } from "./betaInstallScript";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_MAC_INTEL_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "./betaOffer";
import type { ThanksOs } from "./downloadTracking";
import {
  THANKS_DOWNLOADS,
  THANKS_PATH,
  THANKS_TOKEN_KEY,
  THANKS_TOKEN_MAX_AGE_MS,
  openThanks,
  registerThanksNavigation,
  takeThanksToken,
  thanksClick,
  thanksCanonicalHref,
  thanksHref,
  thanksOsForHref,
  thanksSteps,
  type DownloadClick,
} from "./downloadThanks";

after(restoreAnalyticsKeys);

// tsconfig keeps JSX for Next ("preserve"), so tsx compiles component files to classic
// `React.createElement`, which looks React up globally.
Reflect.set(globalThis, "React", React);

const ALL_OS: ThanksOs[] = ["mac", "mac-intel", "windows"];
const marketingRoot = fileURLToPath(new URL("../..", import.meta.url));

let session = new Map<string, string>();
let location = { href: "https://unvibe.site/" };
const realWindow: unknown = Reflect.get(globalThis, "window");

beforeEach(() => {
  session = new Map();
  location = { href: "https://unvibe.site/" };
  Reflect.set(globalThis, "window", {
    location,
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => void session.set(key, value),
      removeItem: (key: string) => void session.delete(key),
    },
  });
});

afterEach(() => {
  Reflect.set(globalThis, "window", realWindow);
});

function render(os: ThanksOs, state: ThanksState): string {
  return renderToStaticMarkup(createElement(ThanksContent, { os, state, decided: true }));
}

/** What a person sees or hears: without the slot's hidden button or lines (CSS hides every one without data-on), and without the pill's drawn faces. */
function shown(html: string): string {
  return html
    .replace(/<a class="paper-join[^"]*"(?![^>]*data-on)[^>]*>[\s\S]*?<\/a>/, "")
    .replace(/<p class="thanks__line"(?![^>]*data-on)[^>]*>[\s\S]*?<\/p>/g, "")
    .replace(/<span class="thanks__pill-face" aria-hidden="true">[\s\S]*?<\/span><\/p>/, "</p>");
}

/** The text inside one element (by class), every tag removed, in document order. */
function slotText(html: string, className: string): string {
  const start = html.indexOf(`class="${className}"`);
  assert.ok(start >= 0, className);
  const open = html.lastIndexOf("<", start);
  const tag = html.slice(open + 1).match(/^\w+/)![0];
  let depth = 0;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = open;
  for (let match = re.exec(html); match; match = re.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(open, re.lastIndex).replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
  }
  throw new Error(`unclosed ${className}`);
}

function lastSegment(href: string): string {
  return new URL(href).pathname.split("/").pop() ?? "";
}

function clickEvent(init: Partial<DownloadClick> = {}): DownloadClick {
  const event: DownloadClick = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    ...init,
  };
  return event;
}

describe("thanks page files", () => {
  it("serves exactly the release constants the download buttons use", () => {
    assert.deepEqual(THANKS_DOWNLOADS, {
      mac: { href: BETA_MAC_DIRECT_DOWNLOAD, file: BETA_INSTALL_ASSET },
      "mac-intel": { href: BETA_MAC_INTEL_DIRECT_DOWNLOAD, file: BETA_MAC_INTEL_ASSET },
      windows: { href: BETA_WINDOWS_DIRECT_DOWNLOAD, file: BETA_WINDOWS_ASSET },
    });
    for (const os of ALL_OS) assert.equal(thanksOsForHref(THANKS_DOWNLOADS[os].href), os);
    assert.equal(thanksOsForHref("/beta"), null);
    assert.equal(thanksOsForHref("/#email-link"), null);
  });

  for (const os of ALL_OS) {
    for (const state of ["ready", "preparing", "started"] as const) {
      it(`${os}, ${state}: the step's file name is the last path segment of the manual and direct links`, () => {
        const html = render(os, state);
        const { href } = THANKS_DOWNLOADS[os];
        const names = Array.from(html.matchAll(/<b>([^<]*\.(?:dmg|exe))<\/b>/g), (match) => match[1]);
        assert.deepEqual(names, [lastSegment(href)], "one step names the file, and it is the linked one");
        const links = Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1]!.replace(/&amp;/g, "&"));
        const fileLinks = links.filter((link) => link.startsWith("https://github.com/"));
        // The shown manual link (or button) and the direct link are this file; the slot's hidden button and line link it too.
        // The only other files are the other Mac build and, on a Mac, the no-JS Windows link.
        const shownLinks = Array.from(shown(html).matchAll(/href="([^"]+)"/g), (match) => match[1]!.replace(/&amp;/g, "&"));
        assert.equal(shownLinks.filter((link) => link === href).length, 2);
        for (const link of fileLinks) assert.ok(ALL_OS.some((other) => THANKS_DOWNLOADS[other].href === link), link);
        assert.ok(links.includes("/install-help?from=thanks"));
      });
    }
  }

  it("names no version or file anywhere but through the release constants", () => {
    const files = [
      "src/lib/downloadThanks.ts",
      "src/components/paper/DownloadThanks.tsx",
      "src/components/paper/DownloadThanksRouter.tsx",
      "src/app/download/thanks/page.tsx",
      ...readdirSync(path.join(marketingRoot, "src/components/paper/thanks-art")).map((name) => `src/components/paper/thanks-art/${name}`),
    ];
    for (const file of files) {
      const source = readFileSync(path.join(marketingRoot, file), "utf8");
      assert.doesNotMatch(source, /\d+\.\d+\.\d+/, `${file} has a literal version`);
      assert.doesNotMatch(source, /Unvibe-[\w.-]+\.(dmg|exe)/, `${file} has a literal file name`);
      assert.doesNotMatch(source, /github\.com/, `${file} has a literal download URL`);
    }
  });
});

describe("thanks page copy", () => {
  it("Mac step 3 is Security's wording (MUST-TD1); Windows says More info, then Run anyway", () => {
    const mac = render("mac", "started");
    assert.ok(mac.includes("Open Unvibe. macOS stops it the first time because it isn&#x27;t notarized yet: press Done, then <b>System Settings → Privacy &amp; Security → Open Anyway</b>, confirm, and enter your Mac password."));
    const windows = render("windows", "started");
    assert.ok(windows.includes("On <b>Windows protected your PC</b>, press <b>More info</b>, then <b>Run anyway</b>. The Windows build isn&#x27;t code-signed yet."));
  });

  it("the line follows the pill", () => {
    const preparing = shown(render("mac", "preparing"));
    assert.match(preparing, /<span class="sr-only">Preparing download<\/span>/);
    assert.match(preparing, /Your download will begin automatically\. If it didn&#x27;t start, <a [^>]*>download Unvibe manually<\/a>\./);
    assert.doesNotMatch(preparing, /has started|Download started|Ready to download|>Download Unvibe for Mac</);
    const started = shown(render("mac", "started"));
    assert.match(started, /<span class="sr-only">Download started<\/span>/);
    assert.match(started, /Your download has started\. If it didn&#x27;t, <a [^>]*>download Unvibe manually<\/a>\./);
    assert.doesNotMatch(started, /will begin automatically|Preparing download|Ready to download/);
    const ready = shown(render("windows", "ready"));
    assert.match(ready, /<span class="sr-only">Ready to download<\/span>/);
    assert.match(ready, />Download Unvibe for Windows</);
    assert.doesNotMatch(ready, /will begin automatically|has started|Preparing download|Download started/);
  });

  it("every state lays out the same pill faces and lead lines, so a state change never moves the page (CLS 0)", () => {
    for (const os of ALL_OS) {
      const [ready, preparing, started] = (["ready", "preparing", "started"] as const).map((state) => render(os, state));
      const face = (html: string) => slotText(html, "thanks__pill-face");
      assert.equal(face(preparing), face(ready), `${os} pill`);
      assert.equal(face(started), face(ready), `${os} pill`);
      // The same three texts are in the lead's cell in every state; only which one shows changes.
      const lines = (html: string) => slotText(html, "thanks__slot").split("|").filter(Boolean).join("").replace(/\s+/g, " ");
      const present = (html: string) => ["Download Unvibe for", "will begin automatically", "has started"].map((text) => lines(html).includes(text));
      for (const html of [ready, preparing, started]) assert.deepEqual(present(html), [true, true, true], os);
    }
  });

  it("the slot is the same elements in every state; only data-on moves, and CSS hides the rest (Design SHOULD-2)", () => {
    const css = readFileSync(path.join(marketingRoot, "src/app/download/thanks/thanks.css"), "utf8");
    assert.match(css, /\.thanks__slot > :not\(\[data-on\]\) \{ visibility: hidden; \}/);
    const expected = { ready: "Download Unvibe for", preparing: "will begin automatically", started: "has started" } as const;
    for (const os of ALL_OS) {
      const slots = (["ready", "preparing", "started"] as const).map((state) => {
        const slot = render(os, state).match(/<div class="thanks__slot">([\s\S]*?)<\/div>/)![1]!;
        assert.equal(slot.match(/data-on=""/g)?.length, 1, `${os} ${state}`);
        const on = slot.match(/<(a|p) [^>]*data-on=""[^>]*>([\s\S]*?)<\/\1>/)![2]!;
        assert.ok(on.includes(expected[state]), `${os} ${state}`);
        return slot.replace(/ data-on=""/, "");
      });
      assert.equal(slots[1], slots[0], os);
      assert.equal(slots[2], slots[0], os);
    }
  });

  it("only the pill is a live region", () => {
    for (const os of ALL_OS) {
      const html = render(os, "preparing");
      assert.equal(html.match(/aria-live=/g)?.length, 1);
      assert.equal(html.match(/role="status"/g)?.length, 1);
    }
  });

  it("uses no em or en dashes", () => {
    for (const os of ALL_OS) {
      for (const state of ["ready", "preparing", "started"] as const) assert.doesNotMatch(render(os, state), /[\u2013\u2014]/);
      for (const step of thanksSteps(os)) assert.doesNotMatch(JSON.stringify(step.caption), /[\u2013\u2014]/);
    }
  });

  it("says what FirstOpenSteps says: each bold step word is emphasised there for the same system (SHOULD-TD7)", () => {
    for (const os of ALL_OS) {
      const fos = renderToStaticMarkup(createElement(FirstOpenSteps, { initialOs: os === "windows" ? "windows" : "mac" }));
      const emphasised = new Set(Array.from(fos.matchAll(/<(b|i)>([^<]*)<\/\1>/g), (m) => m[2]!.replace(/&amp;/g, "&").replace(/[\u201c\u201d]/g, "").trim()));
      for (const step of thanksSteps(os)) {
        for (const part of step.caption) {
          if (typeof part === "string" || part.b === THANKS_DOWNLOADS[os].file) continue;
          for (const phrase of part.b.split(" → ")) assert.ok(emphasised.has(phrase), `${os}: "${phrase}" is not in FirstOpenSteps`);
        }
      }
    }
  });
});

describe("thanks page query (SHOULD-TD6)", () => {
  it("leaves an allowlisted query alone", () => {
    assert.equal(thanksCanonicalHref({ os: "mac", from: "hero" }), null);
    assert.equal(thanksCanonicalHref({ os: "windows", from: "other" }), null);
    assert.equal(thanksCanonicalHref({ from: "nav" }), null);
    assert.equal(thanksCanonicalHref({}), null);
  });

  it("maps a raw from to other and keeps a known os", () => {
    assert.equal(thanksCanonicalHref({ os: "mac", from: "evil@example.com" }), `${THANKS_PATH}?os=mac&from=other`);
  });

  it("drops an unknown os instead of guessing one, so the client still decides the system and the token", () => {
    assert.equal(thanksCanonicalHref({ os: "linux", from: "hero" }), `${THANKS_PATH}?from=hero`);
    assert.equal(thanksCanonicalHref({ os: "other" }), THANKS_PATH);
  });

  it("drops any other parameter and any repeated one", () => {
    assert.equal(thanksCanonicalHref({ os: "mac", from: "hero", utm_source: "x" }), `${THANKS_PATH}?os=mac&from=hero`);
    assert.equal(thanksCanonicalHref({ os: ["mac", "windows"], from: "hero" }), `${THANKS_PATH}?from=hero`);
    assert.equal(thanksCanonicalHref({ os: "mac", from: ["hero", "nav"] }), `${THANKS_PATH}?os=mac`);
  });

  it("an allowlisted href is already canonical", () => {
    for (const os of ALL_OS) {
      const query = Object.fromEntries(new URL(thanksHref(os, "hero"), "https://unvibe.site").searchParams);
      assert.equal(thanksCanonicalHref(query), null, os);
    }
  });
});

describe("thanks click token", () => {
  it("a plain click is tracked by its caller, then writes the token and opens the thanks page", () => {
    const event = clickEvent();
    thanksClick(event, "windows", "hero");
    assert.equal(event.defaultPrevented, true);
    assert.equal(location.href, `${THANKS_PATH}?os=windows&from=hero`);
    const token = JSON.parse(session.get(THANKS_TOKEN_KEY) ?? "null") as { asset: string; at: number };
    assert.equal(token.asset, "windows");
    assert.ok(Math.abs(Date.now() - token.at) < 5_000);
  });

  for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }, { defaultPrevented: true }]) {
    it(`leaves ${JSON.stringify(init)} to the browser`, () => {
      const event = clickEvent(init);
      thanksClick(event, "mac", "hero");
      assert.equal(event.defaultPrevented, init.defaultPrevented ?? false);
      assert.equal(location.href, "https://unvibe.site/");
      assert.equal(session.size, 0);
    });
  }

  it("uses the app router once it is registered", () => {
    const pushed: string[] = [];
    const stop = registerThanksNavigation((href) => void pushed.push(href));
    openThanks("mac-intel", "seo_mac");
    stop();
    openThanks("mac", "hero");
    assert.deepEqual(pushed, [thanksHref("mac-intel", "seo_mac")]);
    assert.equal(location.href, thanksHref("mac", "hero"), "after cleanup it falls back to a full navigation");
  });

  it("a fresh token for the same file starts the download once; reload, Back and a shared link do not", () => {
    openThanks("mac", "hero");
    assert.equal(takeThanksToken("mac"), true);
    assert.equal(session.has(THANKS_TOKEN_KEY), false, "consumed");
    assert.equal(takeThanksToken("mac"), false);
  });

  it("ignores and deletes a token for another file, an old or future one, a broken one, and any token for an unknown os", () => {
    const now = 1_000_000;
    const cases: Array<[ThanksOs | "other", string]> = [
      ["windows", JSON.stringify({ asset: "mac", at: now })],
      ["mac", JSON.stringify({ asset: "mac", at: now - THANKS_TOKEN_MAX_AGE_MS })],
      ["mac", JSON.stringify({ asset: "mac", at: now + 1 })],
      ["mac", JSON.stringify({ asset: "mac" })],
      ["mac", "not json"],
      ["mac", "null"],
      ["other", JSON.stringify({ asset: "other", at: now })],
    ];
    for (const [os, raw] of cases) {
      session.set(THANKS_TOKEN_KEY, raw);
      assert.equal(takeThanksToken(os, now), false, `${os} ${raw}`);
      assert.equal(session.has(THANKS_TOKEN_KEY), false, `${raw} deleted`);
    }
    session.set(THANKS_TOKEN_KEY, JSON.stringify({ asset: "mac", at: now - THANKS_TOKEN_MAX_AGE_MS + 1 }));
    assert.equal(takeThanksToken("mac", now), true);
  });

  it("treats blocked storage as no token", () => {
    Reflect.set(globalThis, "window", {
      location,
      get sessionStorage(): Storage {
        throw new Error("blocked");
      },
    });
    assert.equal(takeThanksToken("mac"), false);
    openThanks("mac", "hero");
    assert.equal(location.href, thanksHref("mac", "hero"), "the page still opens and offers the manual download");
  });
});
