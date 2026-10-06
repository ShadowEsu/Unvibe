/**
 * The one welcome email everyone gets after joining the waitlist or downloading Unvibe.
 * Table layout and inline styles so it renders in Gmail, Outlook and Apple Mail.
 */

export interface WelcomeInput {
  email: string;
  referralCode: string;
  feedbackUrl: string;
  /** Present when they came from a download, so the email can hand the installer back. */
  downloadUrl?: string;
  siteUrl?: string;
}

export const WELCOME_SUBJECT = "You're in! Welcome to Unvibe early access";

const INK = "#141414";
const PAPER = "#f6f1e7";
const LIME = "#d6f45a";
const LILAC = "#b8a6ff";

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function links(input: WelcomeInput) {
  const site = (input.siteUrl ?? "https://unvibe.site").replace(/\/$/, "");
  const code = input.referralCode.toLowerCase();
  return {
    site,
    banner: `${site}/email/welcome-banner.png`,
    pro: `${site}/pricing`,
    referral: `${site}/?ref=${encodeURIComponent(code)}`,
    rewards: `${site}/rewards?ref=${encodeURIComponent(code)}`,
    download: input.downloadUrl || `${site}/#install`,
  };
}

function button(href: string, label: string, background: string): string {
  return `<a href="${escape(href)}" style="display:inline-block;padding:14px 24px;border:2px solid ${INK};border-radius:14px;background:${background};color:${INK};font-weight:800;font-size:16px;text-decoration:none">${label}</a>`;
}

function card(inner: string, background = "#ffffff"): string {
  return `<tr><td style="padding:0 28px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:2px solid ${INK};border-radius:18px;background:${background}"><tr><td style="padding:22px 22px 24px">${inner}</td></tr></table></td></tr>`;
}

export function welcomeHtml(input: WelcomeInput): string {
  const l = links(input);
  const h2 = `margin:0 0 8px;font-size:21px;line-height:1.25;color:${INK}`;
  const p = `margin:0 0 16px;font-size:16px;line-height:1.55;color:#3b3b3b`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Unvibe</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:Helvetica,Arial,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden">Thank you for joining early. Your invite link and a free month of Pro are inside.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:${PAPER}">
<tr><td style="padding:0 0 20px"><a href="${l.site}"><img src="${l.banner}" width="600" alt="You're in. Welcome to Unvibe." style="display:block;width:100%;height:auto;border:2px solid ${INK};border-radius:20px"></a></td></tr>
<tr><td style="padding:0 28px 18px">
<h1 style="margin:0 0 12px;font-size:30px;line-height:1.15;color:${INK}">Congrats, you're in early!</h1>
<p style="${p}">Thank you so much for trying Unvibe this early. You're one of the first people using it, and that means a lot. Unvibe explains the code AI writes for you, right beside your editor, so you actually understand what you ship.</p>
<p style="margin:0">${button(l.download, input.downloadUrl ? "Download Unvibe" : "Get Unvibe free", LIME)}</p>
</td></tr>
${card(`<h2 style="${h2}">Want Pro?</h2><p style="${p}">Deeper explanations, more projects and the full learning history. Your app account already starts with a free month of Pro.</p>${button(l.pro, "See Pro", "#ffffff")}`)}
${card(`<h2 style="${h2}">Your invite link</h2><p style="${p}">Send this to a friend. When they join, you both get a month of Pro. Up to five friends, and the months stack.</p><p style="margin:0 0 16px;padding:12px 14px;border:2px dashed ${INK};border-radius:12px;background:#ffffff;font-family:Menlo,Consolas,monospace;font-size:15px;word-break:break-all"><a href="${escape(l.referral)}" style="color:${INK}">${escape(l.referral)}</a></p>${button(l.rewards, "See your Pro months", "#ffffff")}`, "#eef9c8")}
${card(`<h2 style="${h2}">Tell us what you think, get another month</h2><p style="${p}">Give Unvibe some stars and a few honest words (up to 100). Do it from this link and we add <b>another free month of Pro</b> to this email. More deals are coming for people who help early.</p>${button(input.feedbackUrl, "Give feedback, get a month", LILAC)}`)}
<tr><td style="padding:6px 28px 28px">
<p style="${p}">Thank you so much. Seriously. Reply to this email any time, it comes straight to me.</p>
<p style="margin:0;font-size:16px;line-height:1.55;color:${INK}"><b>Preston</b><br><span style="color:#6b6b6b">Founder, Unvibe</span></p>
</td></tr>
<tr><td style="padding:0 28px 12px;font-size:12px;line-height:1.5;color:#7a7a7a">You get this because ${escape(input.email)} joined Unvibe at <a href="${l.site}" style="color:#7a7a7a">unvibe.site</a>. One welcome email, no spam.</td></tr>
</table></td></tr></table></body></html>`;
}

export function welcomeText(input: WelcomeInput): string {
  const l = links(input);
  return `Congrats, you're in early!

Thank you so much for trying Unvibe this early. You're one of the first people using it, and that means a lot. Unvibe explains the code AI writes for you, right beside your editor.

${input.downloadUrl ? "Download Unvibe" : "Get Unvibe free"}: ${l.download}

WANT PRO?
Your app account already starts with a free month of Pro. See Pro: ${l.pro}

YOUR INVITE LINK
${l.referral}
When a friend joins with it, you both get a month of Pro. Up to five friends, and the months stack.
Your Pro months: ${l.rewards}

TELL US WHAT YOU THINK, GET ANOTHER MONTH
Stars and a few honest words (up to 100). Do it from this link and we add another free month of Pro. More deals are coming for people who help early.
${input.feedbackUrl}

Thank you so much. Reply any time, it comes straight to me.
Preston, Founder, Unvibe`;
}
