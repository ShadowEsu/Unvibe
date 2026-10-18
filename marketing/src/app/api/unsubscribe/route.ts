import { escapeEmailHtml } from "@/emails/betaShared";
import { cancelScheduledEmailsTo } from "@/lib/sendBetaDownloadEmail";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { recordEmailUnsubscribe } from "@/lib/waitlistStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Links carry `e` (the address) and `t` (its HMAC); see lib/unsubscribe. GET only asks, so
 * mail scanners that open links never unsubscribe anyone. POST records: both the button on
 * that page and RFC 8058 one-click (`List-Unsubscribe=One-Click` to the same signed URL).
 * Suppression storage is documented on recordEmailUnsubscribe.
 */

type Outcome = "confirm" | "unsubscribed" | "invalid" | "failed";

const STATUS: Record<Outcome, number> = { confirm: 200, unsubscribed: 200, invalid: 400, failed: 500 };

const MESSAGES: Record<Outcome, { title: string; body: string }> = {
  confirm: { title: "Unsubscribe from Unvibe email?", body: "Press the button and we won't email you again." },
  unsubscribed: { title: "You're unsubscribed.", body: "We won't email you again." },
  invalid: {
    title: "This link does not work.",
    body: "Reply to any Unvibe email with the word stop and we will remove you by hand.",
  },
  failed: {
    title: "We could not save that.",
    body: "Please try again in a minute. You can also reply to any Unvibe email with the word stop.",
  },
};

function signedEmail(url: URL): string | null {
  const email = url.searchParams.get("e")?.trim().toLowerCase() ?? "";
  return email && verifyUnsubscribeToken(email, url.searchParams.get("t") ?? "") ? email : null;
}

function page(outcome: Outcome, url: URL): Response {
  const { title, body } = MESSAGES[outcome];
  const action = escapeEmailHtml(`${url.pathname}${url.search}`);
  const button = outcome === "confirm"
    ? `<form method="post" action="${action}" style="margin:0 0 28px"><button type="submit" style="padding:13px 22px;border:2px solid #141414;border-radius:12px;background:#141414;color:#f6f1e7;font-size:16px;font-weight:700;cursor:pointer">Unsubscribe</button></form>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unvibe email</title></head>
<body style="margin:0;background:#f6f1e7;color:#141414;font-family:Helvetica,Arial,sans-serif">
<main style="max-width:480px;margin:0 auto;padding:72px 24px">
<h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">${title}</h1>
<p style="margin:0 0 28px;font-size:17px;line-height:1.55;color:#3b3b3b">${body}</p>
${button}<p style="margin:0;font-size:15px"><a href="/" style="color:#141414;font-weight:700">Back to unvibe.site</a></p>
</main></body></html>`;
  return new Response(html, {
    status: STATUS[outcome],
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return page(signedEmail(url) ? "confirm" : "invalid", url);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const email = signedEmail(url);
  if (!email) return page("invalid", url);
  try {
    await recordEmailUnsubscribe(email, new Date().toISOString());
  } catch (error) {
    console.error("unsubscribe record failed", error);
    return page("failed", url);
  }
  // The address is already suppressed; a reminder Resend still holds is cancelled best effort.
  await cancelScheduledEmailsTo(email).catch((error) => console.error("scheduled email cancel failed", error));
  return page("unsubscribed", url);
}
