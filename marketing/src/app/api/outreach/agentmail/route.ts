import { NextResponse } from "next/server";
import { verifyAgentMailWebhookSignature } from "@/lib/outreachCompliance";
import { sendCustomerSupportReply } from "@/lib/agentMail";
import { prepareCustomerSupportResponse } from "@/lib/customerSupport";
import {
  createCustomerSupportAction,
  markCustomerSupportActionFailed,
  markCustomerSupportActionSent,
  recordAgentMailEvent,
} from "@/lib/outreachStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nestedString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return undefined;
}

/** Event contacts can be strings, address objects, or an array of either. */
function contactAddress(value: unknown): string | undefined {
  const direct = stringValue(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const address = contactAddress(entry);
      if (address) return address;
    }
    return undefined;
  }
  const record = asRecord(value);
  return record ? nestedString(record, ["address", "email"]) : undefined;
}

function eventDetails(record: Record<string, unknown>): Record<string, unknown> {
  for (const key of ["message", "send", "delivery", "bounce", "complaint", "reject"]) {
    const details = asRecord(record[key]);
    if (details) return details;
  }
  return {};
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyAgentMailWebhookSignature({
    rawBody,
    messageId: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    secret: process.env.AGENTMAIL_WEBHOOK_SIGNING_SECRET,
  })) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
  const record = asRecord(payload);
  if (!record) return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });

  const eventId = nestedString(record, ["event_id", "id", "eventId"]);
  const eventType = nestedString(record, ["event_type", "eventType", "type"]);
  if (!eventId || !eventType) return NextResponse.json({ error: "Webhook is missing an event id or type" }, { status: 400 });

  const details = eventDetails(record);
  const isInboundReply = eventType.startsWith("message.received");
  const sender = isInboundReply
    ? contactAddress(details.from ?? details.sender)
    : contactAddress(details.recipients);
  const text = nestedString(details, ["text", "extracted_text", "preview"]);
  const subject = nestedString(details, ["subject"]);
  try {
    const recorded = await recordAgentMailEvent({
      eventId,
      eventType,
      payload: record,
      messageId: nestedString(details, ["message_id", "id"]) ?? nestedString(record, ["message_id", "messageId"]),
      sender,
      text,
    });
    if (!recorded || !isInboundReply || !sender || !text) return new NextResponse(null, { status: 204 });

    // Avoid mailer loops. An explicit stop is handled as a suppression action.
    if (/^(?:mailer-daemon|postmaster)@/i.test(sender) || /\b(auto(?:matic)?[ -]?reply|out of office|delivery status)\b/i.test(text)) {
      return new NextResponse(null, { status: 204 });
    }
    const support = prepareCustomerSupportResponse({ subject, text });
    const claimed = await createCustomerSupportAction({
      providerEventId: eventId,
      category: support.category,
      decision: support.decision,
      replySubject: support.subject,
      replyText: support.text,
    });
    if (!claimed || support.decision !== "auto_reply") return new NextResponse(null, { status: 204 });
    try {
      const providerMessageId = await sendCustomerSupportReply({ to: sender, subject: support.subject, text: support.text });
      await markCustomerSupportActionSent(eventId, providerMessageId);
    } catch (sendError) {
      // Do not re-send on a webhook retry. The failed action remains visible for founder follow-up.
      await markCustomerSupportActionFailed(eventId, sendError instanceof Error ? sendError.message : "Unknown AgentMail failure");
      console.error("Customer-support auto reply failed", sendError);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("AgentMail webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 503 });
  }
}
