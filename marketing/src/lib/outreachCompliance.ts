import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const OUTREACH_MAX_WORDS = 120;
export const OUTREACH_MAX_DAILY_SENDS = 15;
export const OUTREACH_WEBSITE_LINE = "Website: https://unvibe.site";

export type OutreachSourcePlatform = "github" | "x" | "devpost" | "hacker_news" | "other";

export interface OutreachDraftInput {
  email: string;
  sourcePlatform: OutreachSourcePlatform;
  sourceUrl: string;
  researchNote: string;
  fitScore: number;
  subject: string;
  bodyText: string;
  postalAddress: string;
  unsubscribeUrl: string;
}

export interface OutreachValidationResult {
  valid: boolean;
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /https?:\/\/[^\s)\]}>,]+/gi;
const STOP_RE = /\b(stop|unsubscribe|remove\s+me|do\s+not\s+contact|opt[\s-]?out)\b/i;
const WEBSITE_LINE_RE = /(?:^|\r?\n)Website:\s*https:\/\/unvibe\.site\/?\s*(?:\r?\n|$)/i;

export function normalizeOutreachEmail(value: string): string {
  const bracketed = value.match(/<([^>]+)>/);
  return (bracketed?.[1] ?? value).trim().toLowerCase();
}

export function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/** The scheduler may run more than once; the quota is per calendar day, not per invocation. */
export function remainingDailyOutreachQuota(sentToday: number): number {
  return Math.max(0, OUTREACH_MAX_DAILY_SENDS - Math.max(0, sentToday));
}

/** A contact receives one first touch and, at most, one follow-up after three full days. */
export function isDispatchEligible(input: {
  sequence: 1 | 2;
  contactStatus: "approved" | "sent";
  followUpEligibleAt: string | null;
  now?: Date;
}): boolean {
  if (input.sequence === 1) return input.contactStatus === "approved";
  if (input.contactStatus !== "sent" || !input.followUpEligibleAt) return false;
  const eligibleAt = new Date(input.followUpEligibleAt);
  return !Number.isNaN(eligibleAt.valueOf()) && eligibleAt <= (input.now ?? new Date());
}

export function createUnsubscribeToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashUnsubscribeToken(token: string): string {
  return createHash("sha256").update(`uncode-outreach-unsubscribe-v1:${token}`).digest("hex");
}

export function safeSecretEquals(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

/**
 * Verify AgentMail's Svix webhook signature using the raw request body. This
 * avoids trusting a caller-provided shared header and rejects stale replays.
 */
export function verifyAgentMailWebhookSignature(input: {
  rawBody: string;
  messageId: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string | undefined;
  nowSeconds?: number;
}): boolean {
  const { rawBody, messageId, timestamp, signature, secret } = input;
  if (!messageId || !timestamp || !signature || !secret) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) return false;
  if (Math.abs((input.nowSeconds ?? Math.floor(Date.now() / 1000)) - timestampSeconds) > 5 * 60) return false;

  const encodedSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const signingKey = Buffer.from(encodedSecret, "base64");
  if (signingKey.length === 0) return false;
  const expected = createHmac("sha256", signingKey)
    .update(`${messageId}.${timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);

  return signature.split(/\s+/).some((entry) => {
    const [version, received] = entry.split(",", 2);
    if (version !== "v1" || !received) return false;
    const receivedBuffer = Buffer.from(received);
    return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
  });
}

export function isStopRequest(value: string): boolean {
  return STOP_RE.test(value);
}

function isOwnedUnvibeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "unvibe.site" || url.hostname.endsWith(".unvibe.site"));
  } catch {
    return false;
  }
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Keep every outbound message small, specific, and compliant before it can be
 * approved. This deliberately rejects external campaign links: the approved
 * visitor-facing destination is Unvibe's own site.
 */
export function validateOutreachDraft(input: OutreachDraftInput): OutreachValidationResult {
  const errors: string[] = [];
  const email = normalizeOutreachEmail(input.email);
  if (!EMAIL_RE.test(email)) errors.push("A valid public professional email is required.");
  if (!isPublicHttpsUrl(input.sourceUrl)) errors.push("The research source must be a public HTTPS URL.");
  if (input.researchNote.trim().length < 24) errors.push("Research note must contain a specific detail.");
  if (!Number.isInteger(input.fitScore) || input.fitScore < 65 || input.fitScore > 100) {
    errors.push("Fit score must be between 65 and 100.");
  }
  if (!input.subject.trim()) errors.push("A subject is required.");
  if (wordCount(input.bodyText) > OUTREACH_MAX_WORDS) errors.push(`Email body must be ${OUTREACH_MAX_WORDS} words or fewer.`);
  if (!input.bodyText.includes("https://unvibe.site/")) errors.push("Email must link to https://unvibe.site/.");
  if (!WEBSITE_LINE_RE.test(input.bodyText)) errors.push(`Email must include its own line: ${OUTREACH_WEBSITE_LINE}`);
  if (!input.postalAddress.trim()) errors.push("A physical sender address is required before sending.");
  if (!isOwnedUnvibeUrl(input.unsubscribeUrl)) errors.push("Unsubscribe must use an Unvibe URL.");

  const urls = input.bodyText.match(URL_RE) ?? [];
  if (urls.some((url) => !isOwnedUnvibeUrl(url))) errors.push("Only Unvibe links are allowed in outreach email bodies.");
  if (!input.bodyText.includes(input.unsubscribeUrl)) errors.push("Email must include its unsubscribe link.");
  return { valid: errors.length === 0, errors };
}

export function outboundFooter(postalAddress: string, unsubscribeUrl: string): string {
  return `\n\n— Preston, Unvibe\n${postalAddress}\nReply “stop” to opt out, or unsubscribe: ${unsubscribeUrl}`;
}
