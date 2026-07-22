/**
 * Sends the beta invite email to every waitlist entry that has not received it yet.
 * Safe to re-run: entries are marked `invited_at` after a successful send, so running
 * this again only reaches people who joined the waitlist since the last run.
 *
 * Usage:
 *   npm run send:beta-invites            # dry run — prints who would be emailed
 *   npm run send:beta-invites -- --send  # actually sends via Resend
 */
import { betaInviteHtml, betaInviteText, BETA_INVITE_SUBJECT } from "../src/emails/betaInvite";
import { listUninvited, markInvited } from "../src/lib/waitlistStore";
import { resendConfigured, sendBatch } from "../src/lib/resend";

const BATCH_SIZE = 100; // Resend's batch send limit per call.

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const send = process.argv.includes("--send");
  const uninvited = await listUninvited();

  if (uninvited.length === 0) {
    console.log("Nobody left to invite — every waitlist entry already has invited_at set.");
    return;
  }

  console.log(`${uninvited.length} waitlist entr${uninvited.length === 1 ? "y" : "ies"} not yet invited.`);

  if (!send) {
    console.log("Dry run (pass --send to actually email). First 10 recipients:");
    for (const entry of uninvited.slice(0, 10)) console.log(`  - ${entry.email}`);
    if (uninvited.length > 10) console.log(`  ...and ${uninvited.length - 10} more`);
    return;
  }

  if (!resendConfigured()) {
    console.error("RESEND_API_KEY is not set. Add it to .env.local before running with --send.");
    process.exitCode = 1;
    return;
  }

  const html = betaInviteHtml();
  const text = betaInviteText();
  const invitedAt = new Date().toISOString();

  let sentCount = 0;
  let failCount = 0;

  for (const batch of chunk(uninvited, BATCH_SIZE)) {
    const result = await sendBatch(
      batch.map((entry) => ({ to: entry.email, subject: BETA_INVITE_SUBJECT, html, text }))
    );
    for (const to of result.sent) {
      await markInvited(to, invitedAt);
      sentCount += 1;
    }
    for (const failure of result.failed) {
      console.error(`Failed to send to ${failure.to}: ${failure.error}`);
      failCount += 1;
    }
  }

  console.log(`Sent ${sentCount} invite${sentCount === 1 ? "" : "s"}.${failCount > 0 ? ` ${failCount} failed.` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
