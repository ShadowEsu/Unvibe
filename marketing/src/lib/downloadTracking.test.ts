// First import: unsets the analytics keys before analytics.ts reads them at load.
import { ANALYTICS_KEYS, restoreAnalyticsKeys } from "./testWithoutAnalyticsKeys";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { createRef, isValidElement, type ReactElement, type ReactNode } from "react";
import { FooterLinks } from "@/components/Footer";
import { MacBuildLinks } from "@/components/paper/BetaInstall";
import { DownloadForThisComputer } from "@/components/paper/PhotoHero";
import { ThanksContent } from "@/components/paper/DownloadThanks";
import { siteCommands } from "@/components/paper/SitePalette";
import { trackPlanCta } from "@/components/redesign/PricingPlans";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_MAC_INTEL_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "./betaOffer";
import {
  DOWNLOADED_EVENT,
  downloadSurface,
  installHelpSource,
  thanksOs,
  trackDownloadClick,
  trackDownloadThanksViewed,
  trackInstallHelpViewed,
  watchDownloadCtaView,
} from "./downloadTracking";
import { THANKS_TOKEN_KEY, thanksHref } from "./downloadThanks";
import { pricingCopy } from "./pricingCopy";
import type { OptOutStorage } from "./trackingOptOut";
import { analyticsEnabled } from "./analytics";
import { ANALYTICS_CONSENT_KEY, analyticsConsentRecord } from "./analyticsConsent";

after(restoreAnalyticsKeys);

it("loads analytics with every analytics key unset, so nothing real is sent and no vendor SDK starts", () => {
  for (const name of ANALYTICS_KEYS) assert.equal(process.env[name], undefined, `${name} is unset during these tests`);
  assert.equal(analyticsEnabled, false, "analytics.ts loaded with no key");
});

// tsconfig keeps JSX for Next ("preserve"), so tsx compiles component files to classic
// `React.createElement`, which looks React up globally.
Reflect.set(globalThis, "React", React);

type Props = Record<string, unknown>;
interface Sent {
  event: string;
  properties: Props;
}

/** A browser that pressed Allow on the analytics bar. */
function fakeStorage(): OptOutStorage {
  const data = new Map([[ANALYTICS_CONSENT_KEY, analyticsConsentRecord("allow", new Date("2026-10-28T09:00:00Z"))]]);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Records IntersectionObserver use so a test can move the element in and out of view. */
class FakeObserver {
  static last: FakeObserver | null = null;
  observed: Element[] = [];
  disconnected = false;
  constructor(
    private readonly callback: (entries: Array<{ isIntersecting: boolean; intersectionRatio: number }>) => void,
    readonly options?: { threshold?: number | number[] },
  ) {
    FakeObserver.last = this;
  }
  observe(element: Element): void {
    this.observed.push(element);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  /** Browsers may still deliver an already-queued batch after disconnect, so this fires regardless. */
  show(ratio: number): void {
    this.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]);
  }
}

let requests: string[] = [];
let sent: Sent[] = [];
let dispatched: string[] = [];
/** The page's sessionStorage, where a download click leaves its one-time token. */
let session = new Map<string, string>();
const realWindow: unknown = Reflect.get(globalThis, "window");
const realFetch = globalThis.fetch;

function installWindow({
  search = "",
  pathname = "/",
  webdriver = false,
  userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0",
  referrer = "",
  observer = true,
  storage = fakeStorage(),
}: { search?: string; pathname?: string; webdriver?: boolean; userAgent?: string; referrer?: string; observer?: boolean; storage?: OptOutStorage } = {}): { href: string } {
  const location = { href: `https://unvibe.site${pathname}${search}`, host: "unvibe.site", pathname, search };
  Reflect.set(globalThis, "window", {
    navigator: { webdriver, userAgent, maxTouchPoints: 0 },
    location,
    localStorage: storage,
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => void session.set(key, value),
      removeItem: (key: string) => void session.delete(key),
    },
    document: { referrer },
    IntersectionObserver: observer ? FakeObserver : undefined,
    dispatchEvent: (event: Event) => {
      dispatched.push(event.type);
      return true;
    },
  });
  return location;
}

/** Element nodes in a component's returned tree (child components are not rendered). */
function elements(node: ReactNode): Array<ReactElement<Props>> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

function link(tree: ReactNode, href: string): ReactElement<Props> {
  const found = elements(tree).filter((element) => element.props.href === href);
  assert.equal(found.length, 1, `expected one link to ${href}`);
  return found[0]!;
}

interface FakeClick {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
}

/** Clicks the element (a plain primary click unless `init` says otherwise) and returns the event. */
function click(element: ReactElement<Props>, init: Partial<FakeClick> = {}): FakeClick {
  const onClick = element.props.onClick;
  assert.equal(typeof onClick, "function", "link has no click handler");
  const event: FakeClick = {
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
  (onClick as (event: FakeClick) => void)(event);
  return event;
}

/** The token a download click left for the thanks page, if any. */
function thanksToken(): { asset: string; at: number } | null {
  const raw = session.get(THANKS_TOKEN_KEY);
  return raw ? (JSON.parse(raw) as { asset: string; at: number }) : null;
}

function downloadClick(surface: string, platform: string): Sent {
  return { event: "download_cta_clicked", properties: { surface, platform, path: "/" } };
}

beforeEach(() => {
  requests = [];
  sent = [];
  dispatched = [];
  session = new Map();
  FakeObserver.last = null;
  const recordingFetch: typeof fetch = async (input, init) => {
    requests.push(String(input));
    if (String(input) === "/api/analytics") {
      const body = JSON.parse(String(init?.body)) as { event: string; properties: Props };
      sent.push({ event: body.event, properties: body.properties });
    }
    return new Response(null, { status: 204 });
  };
  globalThis.fetch = recordingFetch;
  installWindow();
});

afterEach(() => {
  Reflect.set(globalThis, "window", realWindow);
  globalThis.fetch = realFetch;
});

describe("download clicks", () => {
  it("trackDownloadClick sends one download_cta_clicked and one downloaded event", () => {
    trackDownloadClick("beta", "windows");
    assert.deepEqual(sent, [downloadClick("beta", "windows")]);
    assert.deepEqual(dispatched, [DOWNLOADED_EVENT]);
  });

  for (const [id, platform] of [
    ["mac", "mac"],
    ["win", "windows"],
  ] as const) {
    it(`palette "${id}" item sends surface palette, platform ${platform}, then opens the thanks page`, () => {
      const location = installWindow();
      const pushed: string[] = [];
      const command = siteCommands((href) => void pushed.push(href)).find((item) => item.id === id);
      assert.ok(command);
      command.run();
      assert.deepEqual(sent, [downloadClick("palette", platform)]);
      assert.deepEqual(dispatched, [DOWNLOADED_EVENT]);
      assert.deepEqual(pushed, [thanksHref(platform, "palette")], "a client navigation to the thanks page");
      assert.equal(location.href, "https://unvibe.site/", "the thanks page asks for the file, not the palette");
      assert.equal(thanksToken()?.asset, platform);
    });
  }

  for (const [device, other, href] of [
    ["mac", "windows", BETA_WINDOWS_DIRECT_DOWNLOAD],
    ["windows", "mac", BETA_MAC_DIRECT_DOWNLOAD],
  ] as const) {
    it(`hero other-OS link on a ${device} sends surface hero_other_os, platform ${other}, then opens the thanks page`, () => {
      const location = installWindow();
      const event = click(link(DownloadForThisComputer({ device, actionsRef: createRef<HTMLDivElement>() }), href));
      assert.deepEqual(sent, [downloadClick("hero_other_os", other)]);
      assert.deepEqual(dispatched, [DOWNLOADED_EVENT]);
      assert.equal(event.defaultPrevented, true);
      assert.equal(location.href, thanksHref(other, "hero_other_os"));
      assert.equal(thanksToken()?.asset, other);
    });
  }

  for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    it(`a modified click (${JSON.stringify(init)}) still tracks but keeps the browser's own download`, () => {
      const location = installWindow();
      const event = click(link(DownloadForThisComputer({ device: "mac", actionsRef: createRef<HTMLDivElement>() }), BETA_WINDOWS_DIRECT_DOWNLOAD), init);
      assert.deepEqual(sent, [downloadClick("hero_other_os", "windows")]);
      assert.equal(event.defaultPrevented, false);
      assert.equal(location.href, "https://unvibe.site/");
      assert.equal(thanksToken(), null);
    });
  }

  for (const [intelMac, href] of [
    [false, BETA_MAC_INTEL_DIRECT_DOWNLOAD],
    [true, BETA_MAC_DIRECT_DOWNLOAD],
  ] as const) {
    it(`download page's other Mac build link (intel=${intelMac}) sends surface beta, platform mac, and downloads in place`, () => {
      const location = installWindow();
      const event = click(link(MacBuildLinks({ intelMac, surface: "beta" }), href));
      assert.deepEqual(sent, [downloadClick("beta", "mac")]);
      assert.deepEqual(dispatched, [DOWNLOADED_EVENT]);
      assert.equal(event.defaultPrevented, false, "/beta keeps its inline install box");
      assert.equal(location.href, "https://unvibe.site/");
      assert.equal(thanksToken(), null);
    });
  }

  it("the other Mac build link anywhere else opens the thanks page for that build", () => {
    const location = installWindow();
    const event = click(link(MacBuildLinks({ intelMac: false, surface: "seo_mac" }), BETA_MAC_INTEL_DIRECT_DOWNLOAD));
    assert.deepEqual(sent, [downloadClick("seo_mac", "mac")]);
    assert.equal(event.defaultPrevented, true);
    assert.equal(location.href, thanksHref("mac-intel", "seo_mac"));
    assert.equal(thanksToken()?.asset, "mac-intel");
  });

  for (const paymentsOpen of [false, true]) {
    it(`pricing download CTAs send surface pricing (payments ${paymentsOpen ? "open" : "closed"}); Teams email does not`, () => {
      for (const plan of pricingCopy(paymentsOpen).plans) trackPlanCta(plan);
      const downloads = sent.filter((item) => item.event === "download_cta_clicked");
      const toDownloadPage = pricingCopy(paymentsOpen).plans.filter((plan) => plan.href === "/beta").length;
      assert.ok(toDownloadPage > 0);
      assert.deepEqual(downloads, Array.from({ length: toDownloadPage }, () => downloadClick("pricing", "other")));
      assert.equal(sent.filter((item) => item.event === "plan_cta_clicked").length, pricingCopy(paymentsOpen).plans.length);
      // These links open the download page, not a download, so the "Downloading!" toast must not open.
      assert.deepEqual(dispatched, []);
    });
  }

  it("footer Download link sends surface footer; other footer links send nothing", () => {
    const tree = FooterLinks({ heading: "Product", links: [["Download", "/beta"], ["Pricing", "/pricing"]] });
    click(link(tree, "/beta"));
    assert.equal(link(tree, "/pricing").props.onClick, undefined);
    assert.deepEqual(sent, [downloadClick("footer", "other")]);
    assert.deepEqual(dispatched, []);
  });
});

describe("download_cta_viewed", () => {
  it("fires once when the hero CTA is at least half visible, even if it leaves and re-enters", () => {
    const element = {} as Element;
    watchDownloadCtaView(element, "hero", "windows");
    const observer = FakeObserver.last;
    assert.ok(observer);
    assert.deepEqual(observer.observed, [element]);
    observer.show(0.3);
    assert.deepEqual(sent, []);
    observer.show(0.5);
    observer.show(0);
    observer.show(1);
    assert.deepEqual(sent, [{ event: "download_cta_viewed", properties: { surface: "hero", platform: "windows", path: "/" } }]);
    assert.equal(observer.disconnected, true);
  });

  it("sends nothing and does not throw without IntersectionObserver", () => {
    installWindow({ observer: false });
    const stop = watchDownloadCtaView({} as Element, "hero", "mac");
    stop();
    assert.deepEqual(requests, []);
  });

  it("stops watching when the hero unmounts", () => {
    const stop = watchDownloadCtaView({} as Element, "hero", "mac");
    stop();
    assert.equal(FakeObserver.last?.disconnected, true);
  });
});

describe("install_help_viewed", () => {
  it("takes an allowlisted ?from= value", () => {
    assert.equal(installHelpSource("?from=installer", "", "unvibe.site"), "installer");
    assert.equal(installHelpSource("?from=Beta", "", "unvibe.site"), "beta");
    assert.equal(installHelpSource("?from=pricing", "https://unvibe.site/beta", "unvibe.site"), "pricing");
    assert.equal(installHelpSource("?from=thanks", "", "unvibe.site"), "thanks", "the thanks page's Read install help link");
  });

  it("turns any other ?from= value into other", () => {
    assert.equal(installHelpSource("?from=newsletter", "https://unvibe.site/", "unvibe.site"), "other");
    assert.equal(installHelpSource("?from=friend%40example.com", "", "unvibe.site"), "other");
    assert.equal(installHelpSource("?from=", "", "unvibe.site"), "other");
    for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      assert.equal(installHelpSource(`?from=${key}`, "", "unvibe.site"), "other", `?from=${key}`);
      assert.equal(installHelpSource("", `https://unvibe.site/${key}`, "unvibe.site"), "other", `referrer /${key}`);
    }
  });

  it("maps a same-site referrer path, never passing the referrer through", () => {
    assert.equal(installHelpSource("", "https://unvibe.site/", "unvibe.site"), "home");
    assert.equal(installHelpSource("", "https://unvibe.site/?ref=abc", "unvibe.site"), "home");
    assert.equal(installHelpSource("", "https://unvibe.site/beta#install", "unvibe.site"), "beta");
    assert.equal(installHelpSource("", "https://unvibe.site/pricing/", "unvibe.site"), "pricing");
    assert.equal(installHelpSource("", "https://unvibe.site/resources", "unvibe.site"), "other");
    assert.equal(installHelpSource("", "https://evil.example/beta", "unvibe.site"), "other");
    assert.equal(installHelpSource("", "", "unvibe.site"), "other");
    assert.equal(installHelpSource("", "not a url", "unvibe.site"), "other");
  });

  it("sends only the allowlisted value and the tab the steps opened on", () => {
    installWindow({ pathname: "/install-help", referrer: "https://unvibe.site/beta?e=me%40example.com" });
    trackInstallHelpViewed();
    installWindow({ pathname: "/install-help", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0" });
    trackInstallHelpViewed();
    assert.deepEqual(sent, [
      { event: "install_help_viewed", properties: { from: "beta", os_default: "mac", path: "/install-help" } },
      { event: "install_help_viewed", properties: { from: "other", os_default: "windows", path: "/install-help" } },
    ]);
  });
});

describe("download_thanks_viewed (Security MUST-TD2)", () => {
  it("maps ?os= to one of the three files and ?from= to a known surface; anything else is other", () => {
    assert.equal(thanksOs("mac"), "mac");
    assert.equal(thanksOs("mac-intel"), "mac-intel");
    assert.equal(thanksOs("windows"), "windows");
    assert.equal(downloadSurface("hero"), "hero");
    assert.equal(downloadSurface("seo_windows"), "seo_windows");
    assert.equal(downloadSurface("thanks"), "thanks");
    for (const near of ["Thanks", "thank", "thanks ", "thanks_page"]) assert.equal(downloadSurface(near), "other", `from ${JSON.stringify(near)}`);
    for (const value of [null, "", "Mac", "linux", " windows", "https://evil.example/x.dmg", "../../x", "<b>", "constructor", "__proto__", "toString"]) {
      assert.equal(thanksOs(value), "other", `os ${JSON.stringify(value)}`);
      assert.equal(downloadSurface(value), "other", `from ${JSON.stringify(value)}`);
    }
  });

  it("sends exactly the mapped values", () => {
    installWindow({ pathname: "/download/thanks" });
    trackDownloadThanksViewed("mac-intel", "hero", true);
    trackDownloadThanksViewed("windows", "other", false);
    assert.deepEqual(sent, [
      { event: "download_thanks_viewed", properties: { os: "mac-intel", from: "hero", auto: true, path: "/download/thanks" } },
      { event: "download_thanks_viewed", properties: { os: "windows", from: "other", auto: false, path: "/download/thanks" } },
    ]);
  });

  for (const [os, state] of [["mac", "started"], ["mac-intel", "preparing"], ["windows", "ready"]] as const) {
    it(`the thanks page's file links (${os}, ${state}) send download_cta_clicked with surface thanks`, () => {
      const fileLinks = elements(ThanksContent({ os, state, decided: true }))
        .filter((element) => String(element.props.href ?? "").startsWith("https://github.com/") && typeof element.props.onClick === "function");
      assert.equal(fileLinks.length, os === "windows" ? 2 : 3, "the manual or button link, the direct link, and on a Mac the other build");
      for (const fileLink of fileLinks) click(fileLink);
      assert.deepEqual(sent, fileLinks.map((fileLink) => downloadClick("thanks", fileLink.props.href === BETA_WINDOWS_DIRECT_DOWNLOAD ? "windows" : "mac")));
      assert.equal(thanksToken(), null, "they download in place: no token, no second thanks page");
    });
  }
});

describe("opt-out", () => {
  for (const [label, options] of [
    ["?notrack=1", { search: "?notrack=1" }],
    ["an automated browser", { webdriver: true }],
  ] as const) {
    it(`sends nothing for ${label}`, () => {
      installWindow({ ...options, referrer: "https://unvibe.site/" });
      for (const command of siteCommands(() => undefined).filter((item) => item.id === "mac" || item.id === "win")) command.run();
      click(link(DownloadForThisComputer({ device: "mac", actionsRef: createRef<HTMLDivElement>() }), BETA_WINDOWS_DIRECT_DOWNLOAD));
      click(link(MacBuildLinks({ intelMac: false, surface: "beta" }), BETA_MAC_INTEL_DIRECT_DOWNLOAD));
      for (const plan of pricingCopy(false).plans) trackPlanCta(plan);
      click(link(FooterLinks({ heading: "Product", links: [["Download", "/beta"]] }), "/beta"));
      watchDownloadCtaView({} as Element, "hero", "mac");
      FakeObserver.last?.show(1);
      trackInstallHelpViewed();
      trackDownloadThanksViewed("mac", "hero", true);
      assert.deepEqual(requests, []);
    });
  }

  it("sends nothing before the visitor answers the analytics bar", () => {
    installWindow({ storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } });
    trackDownloadClick("beta", "mac");
    trackInstallHelpViewed();
    trackDownloadThanksViewed("mac", "hero", true);
    assert.deepEqual(requests, []);
    assert.deepEqual(dispatched, [DOWNLOADED_EVENT], "the download toast still opens");
  });
});
