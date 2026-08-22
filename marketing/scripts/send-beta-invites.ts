/**
 * Safe, idempotent beta invite sender.
 *
 * npm run send:beta-invites             # dry run (never sends)
 * npm run send:beta-invites -- --send   # send only entries not already accepted by Resend
 */
import { BETA_INVITE_SUBJECT, betaInviteHtml, betaInviteText } from "../src/emails/betaInvite";
import { listUninvitedWaitlistEntries, markBetaInviteSent } from "../src/lib/waitlistStore";

const RESEND_BATCH_LIMIT = 100;

function chunks<T>(items: T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / RESEND_BATCH_LIMIT) }, (_, index) =>
    items.slice(index * RESEND_BATCH_LIMIT, (index + 1) * RESEND_BATCH_LIMIT),
  );
}

async function sendBatch(entries: Awaited<ReturnType<typeof listUninvitedWaitlistEntries>>): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY is required to send beta invites.");
  const from = process.env.WAITLIST_FROM_EMAIL?.trim() || "Unvibe <onboarding@resend.com>";
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(entries.map((entry) => ({ from, to: entry.email, subject: BETA_INVITE_SUBJECT, html: betaInviteHtml(entry.firstName), text: betaInviteText(entry.firstName) }))),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend rejected a beta-invite batch (${response.status}): ${detail.slice(0, 500)}`);
  }
}

async function main(): Promise<void> {
  const entries = await listUninvitedWaitlistEntries();
  console.log(`${entries.length} waitlist ${entries.length === 1 ? "person" : "people"} have not received this beta invite.`);
  if (!process.argv.includes("--send")) {
    for (const entry of entries.slice(0, 10)) console.log(`  ${entry.email}`);
    if (entries.length > 10) console.log(`  …and ${entries.length - 10} more`);
    console.log("Dry run only. Re-run with --send after checking the recipient count.");
    return;
  }
  if (entries.length === 0) return;
  let sent = 0;
  for (const batch of chunks(entries)) {
    await sendBatch(batch);
    const acceptedAt = new Date().toISOString();
    await Promise.all(batch.map((entry) => markBetaInviteSent(entry.email, acceptedAt)));
    sent += batch.length;
    console.log(`Accepted by Resend: ${sent}/${entries.length}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
