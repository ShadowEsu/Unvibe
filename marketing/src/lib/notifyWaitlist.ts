import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Notify the founder when someone joins the waitlist.
 * 1) Always append to .data/founder-inbox.json (reliable, local).
 * 2) Try FormSubmit email to WAITLIST_NOTIFY_EMAIL (confirm the first activation email).
 */

const inboxFile = path.join(process.cwd(), ".data", "founder-inbox.json");

async function appendInbox(entry: Record<string, string>): Promise<void> {
  await fs.mkdir(path.dirname(inboxFile), { recursive: true });
  let rows: Record<string, string>[] = [];
  try {
    rows = JSON.parse(await fs.readFile(inboxFile, "utf8")) as Record<
      string,
      string
    >[];
  } catch {
    rows = [];
  }
  rows.unshift(entry);
  await fs.writeFile(inboxFile, JSON.stringify(rows, null, 2), "utf8");
}

export async function notifyFounder(entry: {
  email: string;
  tool: string;
  experience: string;
  message?: string;
  referralCode: string;
  duplicate: boolean;
}): Promise<void> {
  if (entry.duplicate) return;

  const to =
    process.env.WAITLIST_NOTIFY_EMAIL?.trim() ||
    "prestonjaysusanto@gmail.com";

  const record = {
    at: new Date().toISOString(),
    to,
    email: entry.email,
    tool: entry.tool,
    experience: entry.experience,
    message: entry.message || "",
    referralCode: entry.referralCode,
  };

  try {
    await appendInbox(record);
  } catch (err) {
    console.warn("founder inbox write failed", err);
  }

  try {
    const body = new URLSearchParams({
      _subject: `Unvibe waitlist: ${entry.email}`,
      _template: "table",
      _captcha: "false",
      name: "Unvibe Waitlist",
      email: entry.email,
      tool: entry.tool,
      experience: entry.experience,
      message: entry.message || "(none)",
      referralCode: entry.referralCode,
    });

    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    if (!res.ok) {
      console.warn("waitlist email notify failed", res.status, await res.text());
    }
  } catch (err) {
    console.warn("waitlist email notify error", err);
  }
}
