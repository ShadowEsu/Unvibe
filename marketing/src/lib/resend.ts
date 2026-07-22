import { Resend } from "resend";

/**
 * Thin Resend wrapper. Every call is a no-op (and logs a warning) when RESEND_API_KEY is
 * unset, so local development never accidentally sends real email.
 */

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || "Unvibe <onboarding@resend.dev>";
}

export interface BatchEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface BatchSendResult {
  sent: string[];
  failed: Array<{ to: string; error: string }>;
}

/**
 * Sends up to 100 distinct emails in one Resend batch call (their API limit). Callers are
 * responsible for chunking larger lists into batches of 100 or fewer.
 */
export async function sendBatch(emails: BatchEmail[]): Promise<BatchSendResult> {
  if (emails.length === 0) return { sent: [], failed: [] };
  const resend = getClient();
  if (!resend) {
    return {
      sent: [],
      failed: emails.map((e) => ({ to: e.to, error: "RESEND_API_KEY is not set" })),
    };
  }

  const from = fromAddress();
  const { error } = await resend.batch.send(
    emails.map((e) => ({ from, to: e.to, subject: e.subject, html: e.html, text: e.text }))
  );

  if (error) {
    return { sent: [], failed: emails.map((e) => ({ to: e.to, error: error.message })) };
  }

  // The batch endpoint sends all-or-nothing per call; a success means every recipient
  // in this batch was accepted by Resend for delivery.
  return { sent: emails.map((e) => e.to), failed: [] };
}
