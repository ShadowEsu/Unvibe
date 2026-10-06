/**
 * Cold outreach from Preston: one short, personal note with the Unvibe banner.
 * Agents fill the placeholders per person; nothing here is sent automatically.
 */

export interface OutreachInput {
  /** "Hey Sam," style greeting name. Leave empty for "Hey there,". */
  firstName?: string;
  /** One sentence that proves you looked at them: their repo, post, club, course or talk. */
  personalLine: string;
  /** Where the link should point; defaults to the homepage. Add ?ref=<code> to credit a referrer. */
  link?: string;
  siteUrl?: string;
}

export const OUTREACH_SUBJECTS = [
  "Quick one: do you read the code AI writes for you?",
  "Built this for people shipping with Cursor",
  "Free tool for understanding AI-written code",
] as const;

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function bits(input: OutreachInput) {
  const site = (input.siteUrl ?? "https://unvibe.site").replace(/\/$/, "");
  return {
    site,
    banner: `${site}/email/outreach-banner.png`,
    link: input.link || site,
    hello: input.firstName?.trim() ? `Hey ${input.firstName.trim()},` : "Hey there,",
  };
}

export function outreachHtml(input: OutreachInput): string {
  const b = bits(input);
  const p = "margin:0 0 16px;font-size:16px;line-height:1.6;color:#2b2b2b";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unvibe</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#141414">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px">
<tr><td style="padding:0 0 22px"><a href="${escape(b.link)}"><img src="${b.banner}" width="600" alt="Unvibe: understand the code AI ships for you. Free for Mac and Windows." style="display:block;width:100%;height:auto;border:2px solid #141414;border-radius:18px"></a></td></tr>
<tr><td style="padding:0 6px">
<p style="${p}">${escape(b.hello)}</p>
<p style="${p}">${escape(input.personalLine)}</p>
<p style="${p}">I'm Preston, a student builder. I made <b>Unvibe</b> because I kept shipping code from Cursor and Claude that I couldn't fully explain. You select any code, press one key, and a little guy named Vibe explains it right beside your editor, at your level, then checks you actually got it.</p>
<p style="${p}">It's free on Mac and Windows, no card and no API key. I'd love for you to try it and tell me honestly what's missing.</p>
<p style="margin:0 0 22px"><a href="${escape(b.link)}" style="display:inline-block;padding:13px 22px;border:2px solid #141414;border-radius:14px;background:#d6f45a;color:#141414;font-weight:800;font-size:16px;text-decoration:none">Try Unvibe free</a></p>
<p style="${p}">Thanks for reading,<br><b>Preston Susanto</b><br><span style="color:#6b6b6b">Founder, Unvibe · <a href="${b.site}" style="color:#6b6b6b">unvibe.site</a></span></p>
<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a">Not for you? Just reply "no thanks" and I won't email again.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function outreachText(input: OutreachInput): string {
  const b = bits(input);
  return `${b.hello}

${input.personalLine}

I'm Preston, a student builder. I made Unvibe because I kept shipping code from Cursor and Claude that I couldn't fully explain. You select any code, press one key, and a little guy named Vibe explains it right beside your editor, at your level, then checks you actually got it.

It's free on Mac and Windows, no card and no API key. I'd love for you to try it and tell me honestly what's missing.

Try Unvibe free: ${b.link}

Thanks for reading,
Preston Susanto
Founder, Unvibe · ${b.site}

Not for you? Just reply "no thanks" and I won't email again.`;
}
