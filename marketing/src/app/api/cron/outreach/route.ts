import { NextResponse } from "next/server";
import { OUTREACH_MAX_DAILY_SENDS, validateOutreachDraft } from "@/lib/outreachCompliance";
import { sendFounderOutreachSummary, sendWithAgentMail } from "@/lib/agentMail";
import {
  claimOutreachMessage,
  founderSummaryAlreadySent,
  listDispatchableOutreachMessages,
  listSentOutreachMessagesForPacificDay,
  markOutreachMessageSent,
  markFounderSummarySent,
  pacificDateKey,
  releaseOutreachMessageClaim,
  type DispatchableOutreachMessage,
} from "@/lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

function founderSummaryText(sent: DispatchableOutreachMessage[]): string {
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "America/Los_Angeles",
  }).format(new Date());
  const details = sent.map((item, index) => {
    const label = item.contact.first_name?.trim() || `Builder ${index + 1}`;
    const type = item.sequence === 2 ? "follow-up" : "first touch";
    return `${index + 1}. ${label} — ${type}\n   Source: ${item.contact.source_platform} · ${item.contact.source_url}\n   Why: ${item.contact.research_note}`;
  }).join("\n\n");
  return `Unvibe outreach summary — ${date}\n\n${sent.length} message${sent.length === 1 ? "" : "s"} sent today.\n\n${details}\n\nReplies, stop requests, bounces, and complaints are recorded by the verified webhook. A stop, bounce, or complaint is suppressed immediately; a normal reply is never followed up automatically.\n\n— Unvibe outreach`;
}

/**
 * This route is safe to deploy: it reports disabled until a human intentionally
 * sets OUTREACH_SENDING_ENABLED=true after reviewing a first batch.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.OUTREACH_SENDING_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, sent: 0, reason: "Outbound outreach is disabled." });
  }

  const postalAddress = process.env.OUTREACH_POSTAL_ADDRESS?.trim();
  const founderSummaryTo = process.env.OUTREACH_FOUNDER_SUMMARY_TO?.trim();
  if (!postalAddress) return NextResponse.json({ enabled: true, sent: 0, error: "Sender postal address is not configured." }, { status: 503 });
  if (!founderSummaryTo) return NextResponse.json({ enabled: true, sent: 0, error: "Founder summary recipient is not configured." }, { status: 503 });

  try {
    const queue = await listDispatchableOutreachMessages(OUTREACH_MAX_DAILY_SENDS);
    const sent: DispatchableOutreachMessage[] = [];
    const skipped: string[] = [];
    for (const item of queue) {
      const unsubscribeUrlMatch = item.body_text.match(/https:\/\/unvibe\.site\/unsubscribe\?[^\s)\]}>,]+/i);
      const validation = validateOutreachDraft({
        email: item.contact.email,
        sourcePlatform: "other",
        sourceUrl: "https://unvibe.site/",
        researchNote: "Approved through the private outreach research and review workflow.",
        fitScore: 100,
        subject: item.subject,
        bodyText: item.body_text,
        postalAddress,
        unsubscribeUrl: unsubscribeUrlMatch?.[0] ?? "",
      });
      if (!validation.valid) {
        skipped.push(item.id);
        continue;
      }
      if (!await claimOutreachMessage(item.id)) continue;
      let acceptedByProvider = false;
      try {
        const providerMessageId = await sendWithAgentMail({ to: item.contact.email, subject: item.subject, text: item.body_text });
        acceptedByProvider = true;
        await markOutreachMessageSent(item.id, providerMessageId);
        sent.push(item);
      } catch (error) {
        // Once AgentMail has accepted a message, retrying is more dangerous than
        // leaving it queued for manual reconciliation: a retry could duplicate
        // an email that the recipient already received.
        if (!acceptedByProvider) await releaseOutreachMessageClaim(item.id);
        throw error;
      }
    }
    const summaryDate = pacificDateKey();
    const sentToday = await listSentOutreachMessagesForPacificDay(summaryDate);
    let founderSummarySent = false;
    if (sentToday.length > 0 && !await founderSummaryAlreadySent(summaryDate, founderSummaryTo)) {
      await sendFounderOutreachSummary({
        to: founderSummaryTo,
        subject: `Unvibe outreach — ${sentToday.length} sent today`,
        text: founderSummaryText(sentToday),
      });
      await markFounderSummarySent(summaryDate, founderSummaryTo, sentToday.length);
      founderSummarySent = true;
    }
    return NextResponse.json({ enabled: true, sent: sent.length, skipped: skipped.length, founderSummarySent });
  } catch (error) {
    console.error("outreach cron failed", error);
    return NextResponse.json({ error: "Outreach dispatch failed." }, { status: 503 });
  }
}
