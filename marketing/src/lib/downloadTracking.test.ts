import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { createRef, isValidElement, type ReactElement, type ReactNode } from "react";
import { FooterLinks } from "@/components/Footer";
import { MacBuildLinks } from "@/components/paper/BetaInstall";
import { DownloadForThisComputer } from "@/components/paper/PhotoHero";
import { siteCommands } from "@/components/paper/SitePalette";
import { trackPlanCta } from "@/components/redesign/PricingPlans";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_MAC_INTEL_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "./betaOffer";
import {
  DOWNLOADED_EVENT,
  installHelpSource,
  trackDownloadClick,
  trackInstallHelpViewed,
  watchDownloadCtaView,
} from "./downloadTracking";
import { pricingCopy } from "./pricingCopy";
import type { OptOutStorage } from "./trackingOptOut";

// tsconfig keeps JSX for Next ("preserve"), so tsx compiles component files to classic
// `React.createElement`, which looks React up globally.
Reflect.set(globalThis, "React", React);

type Props = Record<string, unknown>;
interface Sent {
  event: string;
  properties: Props;
}

function fakeStorage(): OptOutStorage {
  const data = new Map<string, string>();
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
const realWindow: unknown = Reflect.get(globalThis, "window");
const realFetch = globalThis.fetch;

function installWindow({
  search = "",
  pathname = "/",
  webdriver = false,
  referrer = "",
  observer = true,
  storage = fakeStorage(),
}: { search?: string; pathname?: string; webdriver?: boolean; referrer?: string; observer?: boolean; storage?: OptOutStorage } = {}): { href: string } {
  const location = { href: `https://unvibe.site${pathname}${search}`, host: "unvibe.site", pathname, search };
  Reflect.set(globalThis, "window", {
    navigator: { webdriver },
    location,
    localStorage: storage,
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

function click(element: ReactElement<Props>): void {
  const onClick = element.props.onClick;
  assert.equal(typeof onClick, "function", "link has no click handler");
  (onClick as () => void)();
}

function downloadClick(surface: string, platform: string): Sent {
  return { event: "download_cta_clicked", properties: { surface, platform, path: "/" } };
}

beforeEach(() => {
  requests = [];
  sent = [];
  dispatched = [];
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

  for (const [id, platform, href] of [
    ["mac", "mac", BETA_MAC_DIRECT_DOWNLOAD],
    ["win", "windows", BETA_WINDOWS_DIRECT_DOWNLOAD],
  ] as const) {
    it(`palette "${id}" item sends surface palette, platform ${platform}, then downloads`, () => {
      const location = installWindow();
      const command = siteCommands(() => undefined).find((item) => item.id === id);
      assert.ok(command);
      command.run();
      assert.deepEqual(sent, [downloadClick("palette", platform)]);
      assert.deepEqual(dispatched, [DOWNLOADED_EVENT]);
      assert.equal(location.href, href);
    });
  }

  for (const [device, other, href] of [
    ["mac", "windows", BETA_WINDOWS_DIRECT_DOWNLOAD],
    ["windows", "mac", BETA_MAC_DIRECT_DOWNLOAD],
  ] as const) {
    it(`hero other-OS link on a ${device} sends surface hero_other_os, platform ${other}`, () => {
      click(link(DownloadForThisComputer({ device, actionsRef: createRef<HTMLDivElement>() }), href));
      assert.deepEqual(sent, [downloadClick("hero_other_os", other)]);
      assert.deepEqual(dispatched, [DOWNLOADED_EVENT]);
    });
  }

  for (const [intelMac, href] of [
    [false, BETA_MAC_INTEL_DIRECT_DOWNLOAD],
    [true, BETA_MAC_DIRECT_DOWNLOAD],
  ] as const) {
    it(`download page's other Mac build link (intel=${intelMac}) sends surface beta, platform mac`, () => {
      click(link(MacBuildLinks({ intelMac, surface: "beta" }), href));
      assert.deepEqual(sent, [downloadClick("beta", "mac")]);
      assert.deepEqual(dispatched, [DOWNLOADED_EVENT]);
    });
  }

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
  });

  it("turns any other ?from= value into other", () => {
    assert.equal(installHelpSource("?from=newsletter", "https://unvibe.site/", "unvibe.site"), "other");
    assert.equal(installHelpSource("?from=friend%40example.com", "", "unvibe.site"), "other");
    assert.equal(installHelpSource("?from=", "", "unvibe.site"), "other");
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

  it("sends only the allowlisted value", () => {
    installWindow({ pathname: "/install-help", referrer: "https://unvibe.site/beta?e=me%40example.com" });
    trackInstallHelpViewed();
    assert.deepEqual(sent, [{ event: "install_help_viewed", properties: { from: "beta", path: "/install-help" } }]);
  });
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
      assert.deepEqual(requests, []);
    });
  }
});
