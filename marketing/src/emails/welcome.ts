/**
 * The one welcome email everyone gets after joining the waitlist or downloading Unvibe.
 * Copy: unvibe-support's onboarding email 1 (Security S-2 0002). Its one call to action is /beta,
 * which picks the build for the reader's OS. Table layout and inline styles so it renders in Gmail,
 * Outlook and Apple Mail.
 */

import { escapeEmailHtml as escape } from "./escapeHtml";
import { BETA_INSTALL_COMMAND, BETA_WINDOWS_INSTALL_COMMAND } from "../lib/betaOffer";

export interface WelcomeInput {
  email: string;
  /** Where the button goes; /beta on the site when not given (the download route passes /beta too). */
  downloadUrl?: string;
  /** Signed unsubscribe link for the footer, see lib/unsubscribe. */
  unsubscribeUrl: string;
  /** True when the visitor ticked "Also email me one setup tip tomorrow"; scheduleSetupReminder then sends it. */
  setupTipFollows?: boolean;
  siteUrl?: string;
}

export const WELCOME_SUBJECT = "Your Unvibe download, and the fastest way to install it";
export const WELCOME_PREVIEW =
  "Paste one line into Terminal or PowerShell and Unvibe opens, without the extra security prompts that come with the download.";

const INK = "#141414";
const PAPER = "#f6f1e7";
const LIME = "#d9f45c";

function links(input: WelcomeInput) {
  const site = (input.siteUrl ?? "https://unvibe.site").replace(/\/$/, "");
  return {
    site,
    get: input.downloadUrl || `${site}/beta`,
    installHelp: `${site}/install-help`,
  };
}

/** The footer promise must match what we really send next; used by both parts. */
function followUp(input: WelcomeInput): string {
  return input.setupTipFollows ? "This email and one setup tip tomorrow." : "Just this email.";
}

export function welcomeHtml(input: WelcomeInput): string {
  const l = links(input);
  const p = `margin:0 0 16px;font-size:16px;line-height:1.55;color:#3b3b3b`;
  const link = `color:${INK};font-weight:700;word-break:break-all`;
  const pre = `<pre style="margin:0 0 18px;padding:12px 14px;border:2px solid ${INK};border-radius:12px;background:#ffffff;font-family:Menlo,Consolas,monospace;font-size:14px;line-height:1.5;color:${INK};white-space:pre-wrap;word-break:break-all">`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>Welcome to Unvibe</title><style>:root{color-scheme:light only;supported-color-schemes:light}</style></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:Helvetica,Arial,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden">${WELCOME_PREVIEW}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:${PAPER}">
<tr><td style="padding:0 28px 12px">
<p style="${p}">Thanks for getting Unvibe. It explains the code your AI tools write, in a panel right beside your editor.</p>
<p style="${p}">The fastest install is one line, on the computer you'll use it on.</p>
<p style="${p}"><b style="color:${INK}">On a Mac:</b> open Terminal (press ⌘ Space, type Terminal), paste this, press Return:</p>
${pre}<code>${escape(BETA_INSTALL_COMMAND)}</code></pre>
<p style="${p}"><b style="color:${INK}">On Windows:</b> open PowerShell (Start, type PowerShell), paste this, press Enter:</p>
${pre}<code>${escape(BETA_WINDOWS_INSTALL_COMMAND)}</code></pre>
<p style="${p}">Each line checks the download against its published checksum before installing, then opens Unvibe. You can read both scripts first at <a href="${escape(l.installHelp)}" style="${link}">unvibe.site/install-help</a>.</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:4px 0 20px"><tr><td style="border:2px solid ${INK};border-radius:14px;background:${LIME}"><a href="${escape(l.get)}" style="display:inline-block;padding:14px 28px;font-size:17px;font-weight:800;line-height:1.2;color:${INK};text-decoration:none">Get Unvibe</a></td></tr></table>
<p style="${p}">Would rather download the file? The button above has it too. Unvibe isn't verified by Apple or signed for Windows yet, so the first open shows a warning. Here is exactly what to press: <a href="${escape(l.installHelp)}" style="${link}">${escape(l.installHelp)}</a></p>
<p style="${p}">When it opens, Unvibe explains a short sample for you, then one of your own snippets. No account needed.</p>
<p style="${p}">Reply to this email if anything gets in the way and we'll help.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${INK}"><b>The Unvibe team</b></p>
</td></tr>
<tr><td style="padding:0 28px 12px;font-size:12px;line-height:1.5;color:#7a7a7a">You get this because ${escape(input.email)} asked for Unvibe at <a href="${escape(l.site)}" style="color:#7a7a7a">unvibe.site</a>. ${followUp(input)} Unsubscribe any time: <a href="${escape(input.unsubscribeUrl)}" style="color:#7a7a7a;word-break:break-all">${escape(input.unsubscribeUrl)}</a></td></tr>
</table></td></tr></table></body></html>`;
}

export function welcomeText(input: WelcomeInput): string {
  const l = links(input);
  return `Thanks for getting Unvibe. It explains the code your AI tools write, in a panel right beside your editor.

The fastest install is one line, on the computer you'll use it on.

On a Mac: open Terminal (press ⌘ Space, type Terminal), paste this, press Return:

${BETA_INSTALL_COMMAND}

On Windows: open PowerShell (Start, type PowerShell), paste this, press Enter:

${BETA_WINDOWS_INSTALL_COMMAND}

Each line checks the download against its published checksum before installing, then opens Unvibe. You can read both scripts first at unvibe.site/install-help.

Get Unvibe: ${l.get}

Would rather download the file? The button above has it too. Unvibe isn't verified by Apple or signed for Windows yet, so the first open shows a warning. Here is exactly what to press: ${l.installHelp}

When it opens, Unvibe explains a short sample for you, then one of your own snippets. No account needed.

Reply to this email if anything gets in the way and we'll help.

The Unvibe team

You get this because ${input.email} asked for Unvibe at unvibe.site. ${followUp(input)} Unsubscribe any time: ${input.unsubscribeUrl}`;
}
