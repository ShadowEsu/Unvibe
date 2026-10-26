import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { CaptureResult } from "posthog-js";
import {
  INITIAL_REPLAY_STATE,
  POSTHOG_PRIVACY_CONFIG,
  REPLAY_BLOCK_CLASS,
  analyticsAllowedOnPath,
  initLoadedSdks,
  maskReplayNetworkEntry,
  mixpanelBeforeSend,
  mixpanelPrivacyConfig,
  posthogBeforeSend,
  sanitizeUrl,
  syncCaptureForPage,
  syncReplayForPage,
} from "./analyticsPrivacy";
import { feedbackRewardUrl, signEmail } from "./rewardLink";
import { NOTRACK_STORAGE_KEY } from "./trackingOptOut";
import { unsubscribeUrl } from "./unsubscribe";

process.env.REWARD_LINK_SECRET = "analytics-privacy-test-secret";

const EMAIL = "friend@example.com";
const TOKEN = signEmail(EMAIL);
const GIFT_CODE = "Ab3_x-9QzLmN0pR7";
const STATS_KEY = "k".repeat(6) + "7Hq2";

/** Nothing that identifies the reader or works as a credential survives. */
function assertClean(value: unknown): void {
  const text = JSON.stringify(value);
  for (const secret of [EMAIL, encodeURIComponent(EMAIL), TOKEN, GIFT_CODE, STATS_KEY, "ABCD1234", "pkce-code-0123456789abcdef", "abc.def.ghi"]) {
    assert.ok(!text.includes(secret), `${text} still contains ${secret}`);
  }
}

describe("analytics URL sanitizer", () => {
  it("strips the email and signed token from the welcome email's feedback link", () => {
    const link = feedbackRewardUrl(EMAIL);
    assert.ok(link.includes("e=friend%40example.com") && TOKEN.length === 32, "fixture is the real link shape");
    const clean = sanitizeUrl(link);
    assertClean(clean);
    assert.equal(clean, "https://unvibe.site/?feedback=1&e=redacted&t=redacted");
  });

  it("strips the email and token from unsubscribe links", () => {
    const clean = sanitizeUrl(unsubscribeUrl(EMAIL));
    assertClean(clean);
    assert.equal(clean, "https://unvibe.site/api/unsubscribe?e=redacted&t=redacted");
  });

  it("strips device codes and the OAuth code from /activate", () => {
    for (const link of [
      "https://unvibe.site/activate?user_code=ABCD1234",
      "https://unvibe.site/activate?device=ABCD1234",
      "https://unvibe.site/activate?device_code=ABCD1234",
      "https://unvibe.site/activate?code=pkce-code-0123456789abcdef",
    ]) {
      const clean = sanitizeUrl(link);
      assertClean(clean);
      assert.match(clean, /^https:\/\/unvibe\.site\/activate\?[a-z_]+=redacted$/);
    }
  });

  it("strips invite and gift codes but keeps campaign tags", () => {
    const clean = sanitizeUrl(`https://unvibe.site/?utm_source=x&ref=${GIFT_CODE}`);
    assertClean(clean);
    assert.equal(clean, "https://unvibe.site/?utm_source=x&ref=redacted");
    assert.equal(sanitizeUrl("https://unvibe.site/rewards?ref=ab12cd34"), "https://unvibe.site/rewards?ref=redacted");
  });

  it("hides the stats page key in absolute URLs and bare paths", () => {
    assert.equal(sanitizeUrl(`https://unvibe.site/s/${STATS_KEY}`), "https://unvibe.site/s/redacted");
    assert.equal(sanitizeUrl(`/s/${STATS_KEY}?range=7d`), "/s/redacted?range=7d");
  });

  it("drops token fragments but keeps plain anchors", () => {
    assert.equal(sanitizeUrl("https://unvibe.site/activate#access_token=abc.def.ghi&refresh_token=r1"), "https://unvibe.site/activate");
    assert.equal(sanitizeUrl("https://unvibe.site/#install"), "https://unvibe.site/#install");
  });

  it("redacts an email under any parameter name, and in non-URL values", () => {
    assert.equal(sanitizeUrl("https://unvibe.site/pricing?from=friend%40example.com"), "https://unvibe.site/pricing?from=redacted");
    assert.equal(sanitizeUrl("?feedback=1&e=friend%40example.com"), "?feedback=1&e=redacted");
    assert.equal(sanitizeUrl(EMAIL), "redacted");
  });

  it("leaves clean URLs and PostHog markers byte for byte", () => {
    for (const value of ["https://unvibe.site/pricing?utm_source=newsletter", "https://www.google.com/", "$direct", "/", ""]) {
      assert.equal(sanitizeUrl(value), value);
    }
  });
});

describe("analytics SDK hooks", () => {
  it("PostHog before_send cleans event, person and session entry URLs", () => {
    const link = feedbackRewardUrl(EMAIL);
    const event: CaptureResult = {
      uuid: "u1",
      event: "$pageview",
      properties: {
        $current_url: link,
        $pathname: `/s/${STATS_KEY}`,
        $referrer: unsubscribeUrl(EMAIL),
        $session_entry_url: link,
        $prev_pageview_pathname: "/",
        surface: "email_link",
        $set: { $current_url: link },
      },
      $set_once: { $initial_current_url: link, $initial_referrer: `https://unvibe.site/activate?user_code=ABCD1234` },
    };
    const sent = posthogBeforeSend(event);
    assert.ok(sent);
    assertClean(sent);
    assert.equal(sent.properties.surface, "email_link");
    assert.equal(sent.properties.$prev_pageview_pathname, "/");
    assert.equal(sent.uuid, "u1");
    assert.equal(posthogBeforeSend(null), null);
  });

  it("Mixpanel before_send_events cleans its URL, search and path properties", () => {
    const sent = mixpanelBeforeSend({
      event: "$mp_web_page_view",
      properties: {
        $current_url: feedbackRewardUrl(EMAIL),
        current_url_search: `?feedback=1&e=${encodeURIComponent(EMAIL)}&t=${TOKEN}`,
        current_url_path: `/s/${STATS_KEY}`,
        $initial_referrer: `https://unvibe.site/?ref=${GIFT_CODE}`,
        path: `/s/${STATS_KEY}`,
        token: "project-token",
      },
    });
    assert.ok(sent);
    assertClean(sent);
    assert.equal(sent.properties.token, "project-token", "Mixpanel's own project token property is untouched");
  });

  it("drops every SDK event (pageviews, autocapture, exceptions) sent from an admin or capability page", () => {
    for (const url of ["https://unvibe.site/founder", "https://unvibe.site/waitlist-admin?tab=all", `https://unvibe.site/s/${STATS_KEY}`]) {
      const posthogEvent: CaptureResult = { uuid: "u2", event: "$pageview", properties: { $current_url: url } };
      assert.equal(posthogBeforeSend(posthogEvent), null, url);
      assert.equal(mixpanelBeforeSend({ event: "$mp_click", properties: { $current_url: url } }), null, url);
    }
    const publicEvent: CaptureResult = { uuid: "u3", event: "$pageview", properties: { $current_url: "https://unvibe.site/pricing" } };
    assert.ok(posthogBeforeSend(publicEvent));
    assert.ok(mixpanelBeforeSend({ event: "$mp_click", properties: { $current_url: "https://unvibe.site/pricing" } }));
  });

  it("a PostHog heatmap flush from a public page keeps only public-page keys, sanitized", () => {
    // Security's PoC event: the buffer still holds the last moments on /activate and /redeem.
    const heatmap: CaptureResult = {
      uuid: "u7",
      event: "$$heatmap",
      properties: {
        $current_url: "https://unvibe.site/",
        $heatmap_data: {
          "https://unvibe.site/activate?code=WXYZ-1234": [{ x: 10, y: 20, type: "click" }],
          "https://unvibe.site/redeem?code=ABCD-EFGH-JKLM-NPQR": [{ x: 5, y: 6, type: "click" }],
          "https://unvibe.site/?ref=REFCODE123": [{ x: 1, y: 2, type: "mousemove" }],
          "https://unvibe.site/?ref=OTHERCODE9": [{ x: 3, y: 4, type: "click" }],
        },
      },
    };
    const sent = posthogBeforeSend(heatmap);
    assert.ok(sent, "public-page points still go out");
    assert.deepEqual(sent.properties.$heatmap_data, {
      "https://unvibe.site/?ref=redacted": [{ x: 1, y: 2, type: "mousemove" }, { x: 3, y: 4, type: "click" }],
    });
    for (const secret of ["activate", "redeem", "code=", "REFCODE123", "OTHERCODE9"]) {
      assert.ok(!JSON.stringify(sent).includes(secret), `heatmap still contains ${secret}`);
    }
    const privateOnly: CaptureResult = {
      uuid: "u8",
      event: "$$heatmap",
      properties: {
        $current_url: "https://unvibe.site/",
        $heatmap_data: { "https://unvibe.site/activate?user_code=ABCD1234": [{ x: 1, y: 1, type: "click" }] },
      },
    };
    assert.equal(posthogBeforeSend(privateOnly), null, "a flush with only private-page points is dropped");
  });

  it("PostHog replay keeps no URL secrets, headers or bodies", () => {
    const entry = maskReplayNetworkEntry({
      name: `https://unvibe.site/api/unsubscribe?e=${encodeURIComponent(EMAIL)}&t=${TOKEN}`,
      method: "POST",
      requestHeaders: { authorization: "Bearer abc.def.ghi" },
      requestBody: JSON.stringify({ email: EMAIL }),
      responseHeaders: {},
      responseBody: "explanation of your code",
    });
    assertClean(entry);
    assert.equal(entry.method, "POST");
    assert.equal("requestBody" in entry || "responseBody" in entry || "requestHeaders" in entry, false);
  });
});

describe("analytics privacy config", () => {
  it("PostHog replay masks every element's text and every input, and autocapture keeps no text", () => {
    assert.equal(POSTHOG_PRIVACY_CONFIG.session_recording.maskTextSelector, "*");
    assert.equal(POSTHOG_PRIVACY_CONFIG.session_recording.maskAllInputs, true);
    assert.equal(POSTHOG_PRIVACY_CONFIG.mask_all_text, true);
    assert.equal(POSTHOG_PRIVACY_CONFIG.mask_all_element_attributes, true);
  });

  it("PostHog sends each event when it is captured, so nothing held back goes out after an opt-out or a private page", () => {
    assert.equal(POSTHOG_PRIVACY_CONFIG.request_batching, false);
  });

  it("Mixpanel sends each event when it is tracked, so no stored batch skips before_send_events", () => {
    assert.equal(mixpanelPrivacyConfig().batch_requests, false);
  });

  it("Mixpanel never starts a replay on its own, and holds a new replay's first frames back", () => {
    const config = mixpanelPrivacyConfig();
    assert.equal(config.record_sessions_percent, 0);
    assert.ok(config.record_min_ms > 0, "a recorder stopped right after it came up is discarded unsent");
    assert.equal(config.record_mask_all_text, true);
    assert.equal(config.record_mask_all_inputs, true);
    assert.equal(config.autocapture.capture_text_content, false);
  });

  it("both recorders blank out elements marked with the block class", () => {
    assert.equal(POSTHOG_PRIVACY_CONFIG.session_recording.blockClass, REPLAY_BLOCK_CLASS);
    assert.ok(mixpanelPrivacyConfig().record_block_class.test(REPLAY_BLOCK_CLASS));
    assert.ok(mixpanelPrivacyConfig().record_block_class.test("mp-block"), "Mixpanel's own default class still blocks");
  });

  it("a loaded SDK initialises only on a public page, for a tracked browser, and waits otherwise", () => {
    const loaded = { posthog: "posthog", mixpanel: "mixpanel" };
    for (const page of [
      { href: "https://unvibe.site/founder", trackingDisabled: false },
      { href: `https://unvibe.site/s/${STATS_KEY}`, trackingDisabled: false },
    ]) {
      const calls: string[] = [];
      const init = { posthog: (sdk: string) => void calls.push(sdk), mixpanel: (sdk: string) => void calls.push(sdk) };
      assert.deepEqual(initLoadedSdks(page, loaded, init), loaded, `load that finishes on ${page.href} keeps waiting`);
      assert.deepEqual(calls, [], page.href);
    }
  });

  it("admin and capability pages load no analytics SDK", () => {
    for (const path of ["/founder", "/waitlist", "/waitlist-admin", `/s/${STATS_KEY}`]) {
      assert.equal(analyticsAllowedOnPath(path), false, path);
    }
    for (const path of ["/", "/pricing", "/activated-not-a-page", "/redeemed-not-a-page", "/app", "/waitlisted-not-a-page", "/support"]) {
      assert.equal(analyticsAllowedOnPath(path), true, path);
    }
  });
});

/**
 * Fake SDK clients that log which replay controls were called. Like the real Mixpanel recorder,
 * which reads IndexedDB first, a start only runs when the test calls `recorderComesUp`, and a stop
 * issued before then does not cancel it. A running recorder reports a replay id until stopped.
 */
function fakeSdks({ recording = false } = {}) {
  const calls: string[] = [];
  let mixpanelRecording = recording;
  let startPending = false;
  return {
    calls,
    recorderComesUp: () => {
      if (!startPending) return;
      startPending = false;
      mixpanelRecording = true;
      calls.push("mixpanel.recorder-running");
    },
    sdk: {
      posthog: {
        stopSessionRecording: () => void calls.push("posthog.stop"),
        startSessionRecording: () => void calls.push("posthog.start"),
      },
      mixpanel: {
        stop_session_recording: () => {
          calls.push("mixpanel.stop");
          mixpanelRecording = false;
        },
        start_session_recording: () => {
          calls.push("mixpanel.start");
          startPending = true;
        },
        get_session_recording_properties: () => (mixpanelRecording ? { $mp_replay_id: "replay-1" } : {}),
      },
    },
  };
}

const tracked = { trackingDisabled: false, mixpanelSampled: true };
const PUBLIC = "https://unvibe.site/pricing";
const ADMIN = "https://unvibe.site/waitlist-admin";

describe("session replay on client navigation", () => {
  it("a public page starts the Mixpanel replay once, and only when sampled", () => {
    const { calls, sdk } = fakeSdks();
    const state = syncReplayForPage(INITIAL_REPLAY_STATE, { href: PUBLIC, ...tracked }, sdk);
    assert.deepEqual(syncReplayForPage(state, { href: "https://unvibe.site/", ...tracked }, sdk), state);
    assert.deepEqual(calls, ["mixpanel.start"]);
    const unsampled = fakeSdks();
    syncReplayForPage(INITIAL_REPLAY_STATE, { href: PUBLIC, trackingDisabled: false, mixpanelSampled: false }, unsampled.sdk);
    assert.deepEqual(unsampled.calls, []);
  });

  it("an admin or capability page never starts Mixpanel, even as the first page the SDK sees", () => {
    for (const href of ["https://unvibe.site/founder", "https://unvibe.site/waitlist", ADMIN, `https://unvibe.site/s/${STATS_KEY}`]) {
      const { calls, sdk } = fakeSdks();
      syncReplayForPage(INITIAL_REPLAY_STATE, { href, ...tracked }, sdk);
      assert.ok(!calls.includes("mixpanel.start"), href);
    }
  });

  it("public to admin page stops both recordings, without waiting for a replay id", () => {
    const { calls, sdk } = fakeSdks();
    const started = syncReplayForPage(INITIAL_REPLAY_STATE, { href: PUBLIC, ...tracked }, sdk);
    const state = syncReplayForPage(started, { href: ADMIN, ...tracked }, sdk);
    assert.deepEqual(calls, ["mixpanel.start", "posthog.stop", "mixpanel.stop"]);
    assert.equal(state.posthogPaused, true);
    assert.equal(state.mixpanelStarted, false);
    assert.deepEqual(syncReplayForPage(state, { href: "https://unvibe.site/founder", ...tracked }, sdk), state, "private to private calls nothing");
    assert.equal(calls.length, 3);
  });

  it("a recorder still starting when the visitor reaches an admin page is stopped as soon as it runs", () => {
    const { calls, sdk, recorderComesUp } = fakeSdks();
    let state = syncReplayForPage(INITIAL_REPLAY_STATE, { href: PUBLIC, ...tracked }, sdk);
    state = syncReplayForPage(state, { href: ADMIN, ...tracked }, sdk);
    assert.equal(state.mixpanelStopPending, true, "the caller must check again");
    state = syncReplayForPage(state, { href: ADMIN, ...tracked }, sdk);
    assert.equal(state.mixpanelStopPending, true, "still not running: keep checking, call nothing");
    recorderComesUp();
    state = syncReplayForPage(state, { href: ADMIN, ...tracked }, sdk);
    assert.deepEqual(calls, ["mixpanel.start", "posthog.stop", "mixpanel.stop", "mixpanel.recorder-running", "mixpanel.stop"]);
    assert.deepEqual(sdk.mixpanel.get_session_recording_properties(), {});
    assert.deepEqual(state, { posthogPaused: true, mixpanelStarted: false, mixpanelStopPending: false });
  });

  it("a stop with no start in flight needs no further checks", () => {
    const { sdk } = fakeSdks({ recording: true });
    const state = syncReplayForPage({ ...INITIAL_REPLAY_STATE, mixpanelStarted: true }, { href: ADMIN, ...tracked }, sdk);
    assert.equal(state.mixpanelStopPending, false);
  });

  it("returning to a public page while a stopped start is still in flight keeps that recorder", () => {
    const { calls, sdk, recorderComesUp } = fakeSdks();
    let state = syncReplayForPage(INITIAL_REPLAY_STATE, { href: PUBLIC, ...tracked }, sdk);
    state = syncReplayForPage(state, { href: ADMIN, ...tracked }, sdk);
    state = syncReplayForPage(state, { href: PUBLIC, ...tracked }, sdk);
    recorderComesUp();
    state = syncReplayForPage(state, { href: PUBLIC, ...tracked }, sdk);
    assert.deepEqual(calls, ["mixpanel.start", "posthog.stop", "mixpanel.stop", "posthog.start", "mixpanel.start", "mixpanel.recorder-running"]);
    assert.deepEqual(state, { posthogPaused: false, mixpanelStarted: true, mixpanelStopPending: false });
  });

  it("a replay the SDK resumed on its own is stopped on an admin page", () => {
    const { calls, sdk } = fakeSdks({ recording: true });
    syncReplayForPage(INITIAL_REPLAY_STATE, { href: ADMIN, ...tracked }, sdk);
    assert.deepEqual(calls, ["posthog.stop", "mixpanel.stop"]);
  });

  it("admin to public page resumes PostHog and starts Mixpanel again", () => {
    const { calls, sdk } = fakeSdks();
    const state = syncReplayForPage({ ...INITIAL_REPLAY_STATE, posthogPaused: true }, { href: PUBLIC, ...tracked }, sdk);
    assert.deepEqual(calls, ["posthog.start", "mixpanel.start"]);
    assert.deepEqual(state, { posthogPaused: false, mixpanelStarted: true, mixpanelStopPending: false });
  });

  it("never starts or resumes for automated or opted-out browsers", () => {
    const { calls, sdk } = fakeSdks();
    const paused = { ...INITIAL_REPLAY_STATE, posthogPaused: true };
    const state = syncReplayForPage(paused, { href: PUBLIC, trackingDisabled: true, mixpanelSampled: true }, sdk);
    assert.deepEqual(calls, []);
    assert.deepEqual(state, paused);
  });

  it("never starts Mixpanel while the URL carries a secret, and stops it if one appears", () => {
    const { calls, sdk } = fakeSdks();
    syncReplayForPage({ ...INITIAL_REPLAY_STATE, posthogPaused: true }, { href: feedbackRewardUrl(EMAIL), ...tracked }, sdk);
    assert.deepEqual(calls, ["posthog.start"]);
    const running = fakeSdks({ recording: true });
    syncReplayForPage({ ...INITIAL_REPLAY_STATE, mixpanelStarted: true }, { href: `https://unvibe.site/?ref=${GIFT_CODE}`, ...tracked }, running.sdk);
    assert.deepEqual(running.calls, ["mixpanel.stop"]);
  });

  it("does nothing, and does not throw, before the SDKs have loaded", () => {
    for (const href of ["https://unvibe.site/founder", "https://unvibe.site/"]) {
      const state = syncReplayForPage(INITIAL_REPLAY_STATE, { href, ...tracked }, { posthog: null, mixpanel: null });
      assert.deepEqual(state, INITIAL_REPLAY_STATE, href);
    }
  });
});

/** Fake SDK clients that log which capture controls were called, and keep the opt-out like the real ones. */
function fakeCapture({ posthogOff = false, mixpanelOff = false } = {}) {
  const calls: string[] = [];
  return {
    calls,
    sdk: {
      posthog: {
        has_opted_out_capturing: () => posthogOff,
        opt_out_capturing: () => {
          calls.push("posthog.opt_out");
          posthogOff = true;
        },
        opt_in_capturing: (options: { captureEventName: false }) => {
          calls.push(`posthog.opt_in ${JSON.stringify(options)}`);
          posthogOff = false;
        },
      },
      mixpanel: {
        has_opted_out_tracking: () => mixpanelOff,
        opt_out_tracking: (options: { delete_user: false }) => {
          calls.push(`mixpanel.opt_out ${JSON.stringify(options)}`);
          mixpanelOff = true;
        },
        opt_in_tracking: (options: { track: () => void }) => {
          calls.push(`mixpanel.opt_in track:${typeof options.track}`);
          mixpanelOff = false;
        },
      },
    },
  };
}

describe("an opt-out after the SDKs started", () => {
  const realWindow: unknown = Reflect.get(globalThis, "window");

  /** The browser state `browserTrackingDisabled` reads, on the given query, as after a client navigation. */
  function installWindow(search: string, storage: Map<string, string>) {
    Reflect.set(globalThis, "window", {
      navigator: { webdriver: false },
      location: { href: `${PUBLIC}${search}`, pathname: "/pricing", search },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
        removeItem: (key: string) => void storage.delete(key),
      },
    });
  }

  afterEach(() => {
    Reflect.set(globalThis, "window", realWindow);
  });

  it("both hooks drop the next event, including replay snapshots and events on later pages", () => {
    const storage = new Map<string, string>();
    const posthogEvent = (): CaptureResult => ({ uuid: "u4", event: "$pageview", properties: { $current_url: PUBLIC } });
    const mixpanelEvent = () => ({ event: "$mp_click", properties: { $current_url: PUBLIC } });
    installWindow("", storage);
    assert.ok(posthogBeforeSend(posthogEvent()), "PostHog sends before the opt-out");
    assert.ok(mixpanelBeforeSend(mixpanelEvent()), "Mixpanel sends before the opt-out");
    installWindow("?notrack=1", storage);
    assert.equal(posthogBeforeSend(posthogEvent()), null, "PostHog event after ?notrack=1");
    assert.equal(mixpanelBeforeSend(mixpanelEvent()), null, "Mixpanel event after ?notrack=1");
    installWindow("", storage);
    assert.equal(storage.get(NOTRACK_STORAGE_KEY), "1");
    const snapshot: CaptureResult = { uuid: "u5", event: "$snapshot", properties: { $snapshot_data: [] } };
    assert.equal(posthogBeforeSend(snapshot), null, "PostHog replay snapshot on a later page");
    assert.equal(mixpanelBeforeSend(mixpanelEvent()), null, "Mixpanel event on a later page");
  });

  it("an SDK that finishes loading after the opt-out is not initialised", () => {
    const loaded = { posthog: "posthog", mixpanel: "mixpanel" };
    const calls: string[] = [];
    const init = { posthog: (sdk: string) => void calls.push(sdk), mixpanel: (sdk: string) => void calls.push(sdk) };
    assert.deepEqual(initLoadedSdks({ href: PUBLIC, trackingDisabled: true }, loaded, init), loaded, "still waiting after the opt-out");
    assert.deepEqual(calls, [], "no SDK initialised after the opt-out");
    assert.deepEqual(initLoadedSdks({ href: PUBLIC, trackingDisabled: false }, loaded, init), { posthog: null, mixpanel: null });
    assert.deepEqual(calls, ["posthog", "mixpanel"], "both initialise once tracking is allowed");
  });

  it("turns off both SDKs' capture and stops both replays", () => {
    const capture = fakeCapture();
    const replay = fakeSdks();
    syncCaptureForPage({ href: PUBLIC, trackingDisabled: false }, capture.sdk);
    const started = syncReplayForPage(INITIAL_REPLAY_STATE, { href: PUBLIC, ...tracked }, replay.sdk);
    assert.deepEqual(capture.calls, [], "a tracked page changes nothing");
    const optedOut = { href: `${PUBLIC}?notrack=1`, trackingDisabled: true };
    syncCaptureForPage(optedOut, capture.sdk);
    assert.deepEqual(capture.calls, ["posthog.opt_out", 'mixpanel.opt_out {"delete_user":false}'], "capture turned off");
    syncReplayForPage(started, { ...optedOut, mixpanelSampled: true }, replay.sdk);
    assert.deepEqual(replay.calls, ["mixpanel.start", "posthog.stop", "mixpanel.stop"], "both replays stopped");
    syncCaptureForPage({ href: PUBLIC, trackingDisabled: true }, capture.sdk);
    assert.equal(capture.calls.length, 2, "already off: nothing called again");
  });

  it("?notrack=0, or a later visit, turns capture back on and sends no opt-in event", () => {
    const capture = fakeCapture({ posthogOff: true, mixpanelOff: true });
    syncCaptureForPage({ href: `${PUBLIC}?notrack=0`, trackingDisabled: false }, capture.sdk);
    assert.deepEqual(capture.calls, ['posthog.opt_in {"captureEventName":false}', "mixpanel.opt_in track:function"]);
    syncCaptureForPage({ href: PUBLIC, trackingDisabled: false }, capture.sdk);
    assert.equal(capture.calls.length, 2, "already on: nothing called again");
  });

  it("does nothing, and does not throw, before the SDKs have initialised", () => {
    syncCaptureForPage({ href: PUBLIC, trackingDisabled: true }, { posthog: null, mixpanel: null });
  });
});

const ACTIVATE = "https://unvibe.site/activate?user_code=ABCD1234";
const REDEEM = "https://unvibe.site/redeem?code=PROMO2026";
/** The two pages that hold a sign-in session, with sub-paths and queries. */
const SIGN_IN_URLS = [
  "https://unvibe.site/activate",
  ACTIVATE,
  "https://unvibe.site/activate/done#ok",
  "https://unvibe.site/redeem",
  REDEEM,
  "https://unvibe.site/redeem/confirm?x=1",
];

describe("sign-in pages (/activate, /redeem)", () => {
  it("load no analytics SDK, on a fresh load or when a load finishes there", () => {
    assert.equal(analyticsAllowedOnPath("/activate"), false, "/activate starts no SDK");
    assert.equal(analyticsAllowedOnPath("/redeem"), false, "/redeem starts no SDK");
    for (const path of ["/activate/", "/activate/done", "/redeem/", "/redeem/confirm"]) {
      assert.equal(analyticsAllowedOnPath(path), false, path);
    }
    const loaded = { posthog: "posthog", mixpanel: "mixpanel" };
    for (const href of SIGN_IN_URLS) {
      const calls: string[] = [];
      const init = { posthog: (sdk: string) => void calls.push(sdk), mixpanel: (sdk: string) => void calls.push(sdk) };
      assert.deepEqual(initLoadedSdks({ href, trackingDisabled: false }, loaded, init), loaded, href);
      assert.deepEqual(calls, [], href);
    }
  });

  it("both hooks drop every SDK event recorded on either page", () => {
    for (const url of SIGN_IN_URLS) {
      const posthogEvent: CaptureResult = { uuid: "u6", event: "$autocapture", properties: { $current_url: url } };
      assert.equal(posthogBeforeSend(posthogEvent), null, url);
      assert.equal(mixpanelBeforeSend({ event: "$mp_page_view", properties: { $current_url: url } }), null, url);
    }
  });

  it("a client navigation into either page stops capture and both replays, and back out resumes them", () => {
    for (const href of [ACTIVATE, REDEEM]) {
      const capture = fakeCapture();
      const replay = fakeSdks();
      let state = syncReplayForPage(INITIAL_REPLAY_STATE, { href: PUBLIC, ...tracked }, replay.sdk);
      syncCaptureForPage({ href, trackingDisabled: false }, capture.sdk);
      state = syncReplayForPage(state, { href, ...tracked }, replay.sdk);
      assert.deepEqual(capture.calls, ["posthog.opt_out", 'mixpanel.opt_out {"delete_user":false}'], `${href}: capture off`);
      assert.deepEqual(replay.calls, ["mixpanel.start", "posthog.stop", "mixpanel.stop"], `${href}: replays stopped`);
      syncCaptureForPage({ href: PUBLIC, trackingDisabled: false }, capture.sdk);
      syncReplayForPage(state, { href: PUBLIC, ...tracked }, replay.sdk);
      assert.deepEqual(capture.calls.slice(2), ['posthog.opt_in {"captureEventName":false}', "mixpanel.opt_in track:function"], `${href}: capture back on`);
      assert.deepEqual(replay.calls.slice(3), ["posthog.start", "mixpanel.start"], `${href}: replays resumed`);
    }
  });

  it("leaving either page resumes nothing for a browser that opted out there", () => {
    const capture = fakeCapture();
    const replay = fakeSdks();
    let state = syncReplayForPage(INITIAL_REPLAY_STATE, { href: PUBLIC, ...tracked }, replay.sdk);
    syncCaptureForPage({ href: ACTIVATE, trackingDisabled: false }, capture.sdk);
    state = syncReplayForPage(state, { href: ACTIVATE, ...tracked }, replay.sdk);
    const optedOut = { href: `${PUBLIC}?notrack=1`, trackingDisabled: true };
    syncCaptureForPage(optedOut, capture.sdk);
    syncReplayForPage(state, { ...optedOut, mixpanelSampled: true }, replay.sdk);
    assert.deepEqual(capture.calls, ["posthog.opt_out", 'mixpanel.opt_out {"delete_user":false}'], "capture stays off");
    assert.deepEqual(replay.calls, ["mixpanel.start", "posthog.stop", "mixpanel.stop"], "replays stay stopped");
  });
});
