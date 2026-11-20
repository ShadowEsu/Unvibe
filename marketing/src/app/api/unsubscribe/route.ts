import { escapeEmailHtml } from "@/emails/escapeHtml";
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
    ? `<form method="post" action="${action}"><button type="submit">Unsubscribe</button></form>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unvibe email</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:32px 20px;background:#fff;color:#111;font-family:Helvetica,Arial,sans-serif}
main{width:min(100%,500px);padding:clamp(24px,6vw,40px);border:1px solid rgb(17 17 17 / .11);border-radius:10px;background:#fff}
.brand{margin:0 0 28px;font-size:17px;font-weight:650}h1{margin:0 0 16px;font-size:clamp(26px,5vw,32px);font-weight:600;line-height:1.16;letter-spacing:-.02em}
p{margin:0 0 28px;font-size:17px;line-height:1.5;color:#555}form{margin:0 0 28px}button{min-height:48px;padding:0 24px;border:0;border-radius:999px;background:#111;color:#fff;font:500 16px Helvetica,Arial,sans-serif;cursor:pointer;transition:background-color .1s}button:hover{background:#2e2e2e}
a{color:#111;font-weight:500;text-decoration:underline 1px;text-underline-offset:3px}button:focus-visible,a:focus-visible{outline:2px solid #111;outline-offset:2px}.back{margin:0;font-size:15px}
</style></head>
<body><main>
<div class="brand">Unvibe email</div>
<h1>${title}</h1><p>${body}</p>
${button}<p class="back"><a href="/">Back to unvibe.site</a></p>
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
