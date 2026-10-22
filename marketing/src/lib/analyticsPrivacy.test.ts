import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CaptureResult } from "posthog-js";
import {
  POSTHOG_PRIVACY_CONFIG,
  analyticsAllowedOnPath,
  maskReplayNetworkEntry,
  mixpanelBeforeSend,
  mixpanelPrivacyConfig,
  posthogBeforeSend,
  sanitizeUrl,
} from "./analyticsPrivacy";
import { feedbackRewardUrl, signEmail } from "./rewardLink";
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
    assertClean(sent);
    assert.equal(sent.properties.token, "project-token", "Mixpanel's own project token property is untouched");
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

  it("Mixpanel replay masks all text and inputs, and skips pages whose URL carries a secret", () => {
    const clean = mixpanelPrivacyConfig("https://unvibe.site/pricing");
    assert.equal(clean.record_mask_all_text, true);
    assert.equal(clean.record_mask_all_inputs, true);
    assert.equal(clean.autocapture.capture_text_content, false);
    assert.equal(clean.record_sessions_percent, 100);
    assert.equal(mixpanelPrivacyConfig(feedbackRewardUrl(EMAIL)).record_sessions_percent, 0);
    assert.equal(mixpanelPrivacyConfig("https://unvibe.site/activate?user_code=ABCD1234").record_sessions_percent, 0);
  });

  it("admin and capability pages load no analytics SDK", () => {
    for (const path of ["/founder", "/waitlist", "/waitlist-admin", `/s/${STATS_KEY}`]) {
      assert.equal(analyticsAllowedOnPath(path), false, path);
    }
    for (const path of ["/", "/pricing", "/activate", "/app", "/waitlisted-not-a-page", "/support"]) {
      assert.equal(analyticsAllowedOnPath(path), true, path);
    }
  });
});
