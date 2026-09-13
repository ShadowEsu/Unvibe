import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hashUnsubscribeToken,
  isDispatchEligible,
  isStopRequest,
  normalizeOutreachEmail,
  remainingDailyOutreachQuota,
  type OutreachSourcePlatform,
} from "@/lib/outreachCompliance";

export type OutreachContactStatus = "queued" | "approved" | "sent" | "replied" | "suppressed" | "bounced" | "complained" | "skipped";
export type OutreachMessageStatus = "draft" | "approved" | "queued" | "sent" | "delivered" | "bounced" | "complained" | "rejected" | "replied" | "cancelled";

export interface OutreachContactRow {
  id: string;
  email: string;
  first_name: string | null;
  source_platform: OutreachSourcePlatform;
  source_url: string;
  research_note: string;
  fit_score: number;
  status: OutreachContactStatus;
  unsubscribe_token_hash: string;
  suppressed_at: string | null;
  suppression_reason: "unsubscribe" | "reply_stop" | "bounce" | "complaint" | "manual" | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachMessageRow {
  id: string;
  contact_id: string;
  campaign: string;
  sequence: 1 | 2;
  subject: string;
  body_text: string;
  provider: "agentmail";
  provider_message_id: string | null;
  status: OutreachMessageStatus;
  sent_at: string | null;
  follow_up_eligible_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchableOutreachMessage extends OutreachMessageRow {
  contact: Pick<OutreachContactRow, "id" | "email" | "first_name" | "source_platform" | "source_url" | "research_note" | "status" | "suppressed_at">;
}

export interface FounderDispatchSummary {
  entries: Array<{
    firstName: string | null;
    sourcePlatform: OutreachSourcePlatform;
    sourceUrl: string;
    researchNote: string;
    sequence: 1 | 2;
  }>;
}

interface OutreachDailySummaryRow {
  id: string;
  summary_date: string;
  recipient: string;
  sent_count: number;
  status: "queued" | "sent";
  sent_at: string | null;
}

interface AgentMailEventInput {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  messageId?: string;
  sender?: string;
  text?: string;
}

export type CustomerSupportActionStatus = "queued" | "draft" | "sent" | "failed" | "suppressed";
export interface CustomerSupportActionInput {
  providerEventId: string;
  category: string;
  decision: "auto_reply" | "draft" | "suppress";
  replySubject: string;
  replyText: string;
}

let cachedSupabase: SupabaseClient | null = null;

function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function supabaseClient(): SupabaseClient {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase outreach storage is not configured");
  cachedSupabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return cachedSupabase;
}

function timestamp(): string {
  return new Date().toISOString();
}

function zonedDateParts(value: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

export function pacificDateKey(value = new Date()): string {
  const { year, month, day } = zonedDateParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Converts a midnight America/Los_Angeles calendar boundary into UTC, including DST transitions. */
function pacificMidnightUtc(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("Invalid Pacific calendar date");
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0);
  let candidate = target;
  // A short convergence loop maps the requested local wall clock time to UTC.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = zonedDateParts(new Date(candidate));
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    candidate += target - observedAsUtc;
  }
  return new Date(candidate);
}

function nextPacificDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function eventStatus(eventType: string): OutreachMessageStatus | null {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("delivered")) return "delivered";
  if (normalized.includes("bounced")) return "bounced";
  if (normalized.includes("complained")) return "complained";
  if (normalized.includes("rejected")) return "rejected";
  if (normalized.includes("received")) return "replied";
  return null;
}

async function findContactByEmail(email: string): Promise<OutreachContactRow | null> {
  const { data, error } = await supabaseClient()
    .from("outreach_contacts")
    .select("*")
    .eq("email", normalizeOutreachEmail(email))
    .maybeSingle<OutreachContactRow>();
  if (error) throw new Error(`Supabase outreach contact read failed: ${error.message}`);
  return data;
}

export async function suppressOutreachContact(token: string, reason: "unsubscribe" | "reply_stop" | "bounce" | "complaint" | "manual" = "unsubscribe"): Promise<boolean> {
  if (!supabaseConfigured()) throw new Error("Supabase outreach storage is not configured");
  const { data, error } = await supabaseClient()
    .from("outreach_contacts")
    .update({ status: "suppressed", suppressed_at: timestamp(), suppression_reason: reason, updated_at: timestamp() })
    .eq("unsubscribe_token_hash", hashUnsubscribeToken(token))
    .select("id");
  if (error) throw new Error(`Supabase outreach suppression failed: ${error.message}`);
  return (data ?? []).length > 0;
}

async function suppressByEmail(email: string, reason: "reply_stop" | "bounce" | "complaint"): Promise<OutreachContactRow | null> {
  const contact = await findContactByEmail(email);
  if (!contact) return null;
  const now = timestamp();
  const { data, error } = await supabaseClient()
    .from("outreach_contacts")
    .update({ status: "suppressed", suppressed_at: now, suppression_reason: reason, updated_at: now })
    .eq("id", contact.id)
    .select("*")
    .single<OutreachContactRow>();
  if (error) throw new Error(`Supabase outreach suppression failed: ${error.message}`);
  return data;
}

/**
 * AgentMail events are stored first for idempotency. A bounce, complaint, or a
 * direct “stop” reply suppresses the contact immediately, before any follow-up
 * can become eligible.
 */
export async function recordAgentMailEvent(event: AgentMailEventInput): Promise<boolean> {
  if (!supabaseConfigured()) throw new Error("Supabase outreach storage is not configured");
  const normalizedSender = event.sender ? normalizeOutreachEmail(event.sender) : "";
  const contact = normalizedSender ? await findContactByEmail(normalizedSender) : null;
  let message: OutreachMessageRow | null = null;
  if (event.messageId) {
    const { data, error } = await supabaseClient()
      .from("outreach_messages")
      .select("*")
      .eq("provider_message_id", event.messageId)
      .maybeSingle<OutreachMessageRow>();
    if (error) throw new Error(`Supabase outreach message read failed: ${error.message}`);
    message = data;
  }

  const { error: eventError } = await supabaseClient().from("outreach_events").insert({
    provider_event_id: event.eventId,
    contact_id: contact?.id ?? message?.contact_id ?? null,
    message_id: message?.id ?? null,
    event_type: event.eventType,
    payload: event.payload,
  });
  // A duplicate webhook is already handled. Do not re-run side effects.
  if (eventError) {
    if (eventError.code === "23505") return false;
    throw new Error(`Supabase outreach event write failed: ${eventError.message}`);
  }

  const status = eventStatus(event.eventType);
  if (message && status) {
    const { error } = await supabaseClient()
      .from("outreach_messages")
      .update({ status, updated_at: timestamp() })
      .eq("id", message.id);
    if (error) throw new Error(`Supabase outreach message status failed: ${error.message}`);
  }

  const normalizedType = event.eventType.toLowerCase();
  if (normalizedSender && (normalizedType.includes("bounced") || normalizedType.includes("complained"))) {
    await suppressByEmail(normalizedSender, normalizedType.includes("complained") ? "complaint" : "bounce");
  } else if (normalizedSender && normalizedType.includes("received") && event.text && isStopRequest(event.text)) {
    await suppressByEmail(normalizedSender, "reply_stop");
  } else if (contact && normalizedType.includes("received")) {
    const { error } = await supabaseClient()
      .from("outreach_contacts")
      .update({ status: "replied", updated_at: timestamp() })
      .eq("id", contact.id);
    if (error) throw new Error(`Supabase outreach reply status failed: ${error.message}`);
  }
  return true;
}

/**
 * Reserve each inbound event before a response is sent. The unique provider
 * event id makes an AgentMail webhook replay incapable of sending a duplicate
 * auto-reply. Drafts contain only the reply we would send, not copied inbound
 * message text.
 */
export async function createCustomerSupportAction(input: CustomerSupportActionInput): Promise<boolean> {
  if (!supabaseConfigured()) throw new Error("Supabase outreach storage is not configured");
  const status: CustomerSupportActionStatus = input.decision === "auto_reply"
    ? "queued"
    : input.decision === "draft" ? "draft" : "suppressed";
  const { error } = await supabaseClient().from("customer_support_actions").insert({
    provider_event_id: input.providerEventId,
    category: input.category,
    decision: input.decision,
    status,
    reply_subject: input.replySubject,
    reply_text: input.replyText,
  });
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(`Supabase customer-support action write failed: ${error.message}`);
  }
  return true;
}

export async function markCustomerSupportActionSent(providerEventId: string, providerMessageId: string): Promise<void> {
  const { error } = await supabaseClient()
    .from("customer_support_actions")
    .update({ status: "sent", provider_message_id: providerMessageId, sent_at: timestamp(), updated_at: timestamp() })
    .eq("provider_event_id", providerEventId)
    .eq("status", "queued");
  if (error) throw new Error(`Supabase customer-support sent status failed: ${error.message}`);
}

export async function markCustomerSupportActionFailed(providerEventId: string, reason: string): Promise<void> {
  const { error } = await supabaseClient()
    .from("customer_support_actions")
    .update({ status: "failed", failure_reason: reason.slice(0, 500), updated_at: timestamp() })
    .eq("provider_event_id", providerEventId)
    .eq("status", "queued");
  if (error) throw new Error(`Supabase customer-support failure status failed: ${error.message}`);
}

/** Only explicitly approved first-touch or follow-up drafts can be dispatched. */
export async function listDispatchableOutreachMessages(limit: number): Promise<DispatchableOutreachMessage[]> {
  if (!supabaseConfigured()) throw new Error("Supabase outreach storage is not configured");
  const now = new Date();
  // The product promise is 15 messages per weekday in Pacific time. Using UTC
  // here would silently give a late-afternoon run a new quota before the local
  // business day has finished.
  const pacificDay = pacificDateKey(now);
  const startOfDay = pacificMidnightUtc(pacificDay).toISOString();
  const endOfDay = pacificMidnightUtc(nextPacificDateKey(pacificDay)).toISOString();
  const { count, error: sentCountError } = await supabaseClient()
    .from("outreach_messages")
    .select("id", { count: "exact", head: true })
    .not("sent_at", "is", null)
    .gte("sent_at", startOfDay)
    .lt("sent_at", endOfDay);
  if (sentCountError) throw new Error(`Supabase outreach daily quota read failed: ${sentCountError.message}`);

  const safeLimit = Math.min(Math.max(1, Math.min(limit, 15)), remainingDailyOutreachQuota(count ?? 0));
  if (safeLimit === 0) return [];
  const { data, error } = await supabaseClient()
    .from("outreach_messages")
    .select("*, outreach_contacts!inner(id,email,first_name,source_platform,source_url,research_note,status,suppressed_at)")
    .eq("status", "approved")
    .in("outreach_contacts.status", ["approved", "sent"])
    .is("outreach_contacts.suppressed_at", null)
    .order("created_at", { ascending: true })
    // Read a small buffer because second-touch drafts are filtered below.
    .limit(Math.max(safeLimit * 3, 30));
  if (error) throw new Error(`Supabase outreach queue read failed: ${error.message}`);
  return (data ?? []).map((row) => {
    const joined = row as OutreachMessageRow & { outreach_contacts: DispatchableOutreachMessage["contact"] };
    const { outreach_contacts, ...message } = joined;
    return { ...message, contact: outreach_contacts };
  }).filter((item) => isDispatchEligible({
    sequence: item.sequence,
    contactStatus: item.contact.status === "sent" ? "sent" : "approved",
    followUpEligibleAt: item.follow_up_eligible_at,
    now,
  })).slice(0, safeLimit);
}

/**
 * Claim before handing a message to the provider. This prevents two cron
 * invocations from sending the same approved message concurrently.
 */
export async function claimOutreachMessage(messageId: string): Promise<boolean> {
  const { data, error } = await supabaseClient()
    .from("outreach_messages")
    .update({ status: "queued", updated_at: timestamp() })
    .eq("id", messageId)
    .eq("status", "approved")
    .select("id");
  if (error) throw new Error(`Supabase outreach claim failed: ${error.message}`);
  return (data ?? []).length === 1;
}

/** A provider failure returns the safely claimed draft to the reviewed queue. */
export async function releaseOutreachMessageClaim(messageId: string): Promise<void> {
  const { error } = await supabaseClient()
    .from("outreach_messages")
    .update({ status: "approved", updated_at: timestamp() })
    .eq("id", messageId)
    .eq("status", "queued");
  if (error) throw new Error(`Supabase outreach claim release failed: ${error.message}`);
}

export async function listSentOutreachMessagesForPacificDay(dateKey = pacificDateKey()): Promise<DispatchableOutreachMessage[]> {
  if (!supabaseConfigured()) throw new Error("Supabase outreach storage is not configured");
  const start = pacificMidnightUtc(dateKey).toISOString();
  const end = pacificMidnightUtc(nextPacificDateKey(dateKey)).toISOString();
  const { data, error } = await supabaseClient()
    .from("outreach_messages")
    .select("*, outreach_contacts!inner(id,email,first_name,source_platform,source_url,research_note,status,suppressed_at)")
    .not("sent_at", "is", null)
    .gte("sent_at", start)
    .lt("sent_at", end)
    .order("sent_at", { ascending: true });
  if (error) throw new Error(`Supabase outreach daily summary read failed: ${error.message}`);
  return (data ?? []).map((row) => {
    const joined = row as OutreachMessageRow & { outreach_contacts: DispatchableOutreachMessage["contact"] };
    const { outreach_contacts, ...message } = joined;
    return { ...message, contact: outreach_contacts };
  });
}

export async function founderSummaryAlreadySent(dateKey: string, recipient: string): Promise<boolean> {
  const { data, error } = await supabaseClient()
    .from("outreach_daily_summaries")
    .select("status")
    .eq("summary_date", dateKey)
    .eq("recipient", normalizeOutreachEmail(recipient))
    .maybeSingle<Pick<OutreachDailySummaryRow, "status">>();
  if (error) throw new Error(`Supabase outreach summary read failed: ${error.message}`);
  return data?.status === "sent";
}

export async function markFounderSummarySent(dateKey: string, recipient: string, sentCount: number): Promise<void> {
  const now = timestamp();
  const { error } = await supabaseClient()
    .from("outreach_daily_summaries")
    .upsert({
      summary_date: dateKey,
      recipient: normalizeOutreachEmail(recipient),
      sent_count: sentCount,
      status: "sent",
      sent_at: now,
      updated_at: now,
    }, { onConflict: "summary_date,recipient" });
  if (error) throw new Error(`Supabase outreach summary write failed: ${error.message}`);
}

export async function markOutreachMessageSent(messageId: string, providerMessageId: string): Promise<void> {
  const now = timestamp();
  const followUp = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseClient()
    .from("outreach_messages")
    .update({ status: "sent", provider_message_id: providerMessageId, sent_at: now, follow_up_eligible_at: followUp, updated_at: now })
    .eq("id", messageId);
  if (error) throw new Error(`Supabase outreach sent status failed: ${error.message}`);
  const { data: message, error: readError } = await supabaseClient()
    .from("outreach_messages")
    .select("contact_id,sequence")
    .eq("id", messageId)
    .single<Pick<OutreachMessageRow, "contact_id" | "sequence">>();
  if (readError) throw new Error(`Supabase outreach sent message read failed: ${readError.message}`);
  if (message.sequence === 1) {
    const { error: contactError } = await supabaseClient()
      .from("outreach_contacts")
      .update({ status: "sent", updated_at: now })
      .eq("id", message.contact_id)
      .eq("status", "approved");
    if (contactError) throw new Error(`Supabase outreach contact status failed: ${contactError.message}`);
  }
}
