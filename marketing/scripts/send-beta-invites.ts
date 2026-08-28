/**
 * Safe, idempotent beta invite sender.
 *
 * npm run send:beta-invites
 * npm run send:beta-invites -- --to mirzett
 * npm run send:beta-invites -- --send --to mirzett
 */
import { loadEnvConfig } from "@next/env";
import { BETA_INVITE_SUBJECT, betaInviteHtml, betaInviteText } from "../src/emails/betaInvite";
import { listUninvitedWaitlistEntries, listWaitlistEntries, markBetaInviteSent } from "../src/lib/waitlistStore";

loadEnvConfig(process.cwd());

const RESEND_BATCH_LIMIT = 100;

type Invitee = { email: string; firstName: string; onWaitlist: boolean };

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function chunks<T>(items: T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / RESEND_BATCH_LIMIT) }, (_, index) =>
    items.slice(index * RESEND_BATCH_LIMIT, (index + 1) * RESEND_BATCH_LIMIT),
  );
}

function matchesNeedle(entry: { email: string; firstName: string; lastName?: string }, needle: string): boolean {
  const haystack = `${entry.email} ${entry.firstName} ${entry.lastName ?? ""}`.toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

async function resolveInvitees(needle?: string): Promise<Invitee[]> {
  if (!needle) {
    const uninvited = await listUninvitedWaitlistEntries();
    return uninvited.map((entry) => ({ email: entry.email, firstName: entry.firstName, onWaitlist: true }));
  }
  const all = await listWaitlistEntries(10_000);
  const hits = all.filter((entry) => matchesNeedle(entry, needle));
  if (hits.length > 0) {
    return hits.map((entry) => ({ email: entry.email, firstName: entry.firstName, onWaitlist: true }));
  }
  if (needle.includes("@")) {
    const local = needle.split("@")[0] ?? "there";
    const firstName = local.charAt(0).toUpperCase() + local.slice(1);
    return [{ email: needle, firstName, onWaitlist: false }];
  }
  return [];
}

async function sendBatch(entries: Invitee[]): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY is required to send beta invites.");
  const from = process.env.WAITLIST_FROM_EMAIL?.trim()
    || process.env.RESEND_FROM_EMAIL?.trim()
    || "Unvibe <onboarding@resend.com>";
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(entries.map((entry) => ({
      from,
      to: entry.email,
      reply_to: "preston@unvibe.site",
      subject: BETA_INVITE_SUBJECT,
      html: betaInviteHtml(entry.firstName),
      text: betaInviteText(entry.firstName),
    }))),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected a beta-invite batch (${response.status}): ${detail.slice(0, 500)}`);
  }
}

async function main(): Promise<void> {
  const needle = argValue("--to");
  const send = process.argv.includes("--send");
  const entries = await resolveInvitees(needle);
  const keyReady = Boolean(process.env.RESEND_API_KEY?.trim());
  const fromReady = Boolean(process.env.WAITLIST_FROM_EMAIL?.trim() || process.env.RESEND_FROM_EMAIL?.trim());
  console.log(`Resend key: ${keyReady ? "set" : "missing"}`);
  console.log(`From address: ${fromReady ? "set" : "missing, will use Resend onboarding sender"}`);
  if (needle) console.log(`Filter: ${needle}`);
  console.log(`${entries.length} ${entries.length === 1 ? "person" : "people"} to email.`);
  for (const entry of entries.slice(0, 20)) {
    console.log(`  ${entry.email} (${entry.firstName || "no first name"})${entry.onWaitlist ? "" : " not on waitlist"}`);
  }
  if (entries.length > 20) console.log(`  …and ${entries.length - 20} more`);
  if (!send) {
    console.log("Dry run only. Re-run with --send after checking the recipient list.");
    return;
  }
  if (entries.length === 0) {
    console.log("Nobody to send to.");
    return;
  }
  let sent = 0;
  for (const batch of chunks(entries)) {
    await sendBatch(batch);
    const acceptedAt = new Date().toISOString();
    await Promise.all(batch.filter((entry) => entry.onWaitlist).map((entry) => markBetaInviteSent(entry.email, acceptedAt)));
    sent += batch.length;
    console.log(`Accepted by Resend: ${sent}/${entries.length}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
