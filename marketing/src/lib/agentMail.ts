export interface AgentMailSendInput {
  to: string;
  subject: string;
  text: string;
}

export interface AgentMailFounderSummaryInput {
  to: string;
  subject: string;
  text: string;
}

export interface AgentMailCustomerSupportInput {
  to: string;
  subject: string;
  text: string;
}

interface AgentMailSendResponse {
  message_id?: string;
  id?: string;
  message?: string;
}

function agentMailConfig(): { apiKey: string; inboxId: string; replyTo: string } {
  const apiKey = process.env.AGENTMAIL_API_KEY?.trim();
  const inboxId = process.env.AGENTMAIL_INBOX_ID?.trim();
  const replyTo = process.env.OUTREACH_REPLY_TO?.trim() || "preston@unvibe.site";
  if (!apiKey || !inboxId) throw new Error("AgentMail sending is not configured");
  return { apiKey, inboxId, replyTo };
}

/**
 * Network sending is intentionally gated by an environment variable. Deploying
 * the code, importing prospects, or receiving a webhook cannot send email.
 */
async function sendAgentMailMessage(input: AgentMailSendInput): Promise<string> {
  const { apiKey, inboxId, replyTo } = agentMailConfig();
  const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: [input.to], subject: input.subject, text: input.text, reply_to: replyTo }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as AgentMailSendResponse;
  if (!response.ok) throw new Error(`AgentMail send failed: ${response.status} ${payload.message ?? ""}`.trim());
  const messageId = payload.message_id ?? payload.id;
  if (!messageId) throw new Error("AgentMail did not return a message id");
  return messageId;
}

export async function sendWithAgentMail(input: AgentMailSendInput): Promise<string> {
  if (process.env.OUTREACH_SENDING_ENABLED !== "true") throw new Error("Outbound outreach is disabled");
  return sendAgentMailMessage(input);
}

/** Customer support has its own explicit switch, independent of cold outreach. */
export async function sendCustomerSupportReply(input: AgentMailCustomerSupportInput): Promise<string> {
  if (process.env.CUSTOMER_SUPPORT_AUTOREPLY_ENABLED !== "true") {
    throw new Error("Customer-support auto replies are disabled");
  }
  return sendAgentMailMessage(input);
}

/** Founder summaries use the same verified sender and are never sent before live outreach is intentionally enabled. */
export async function sendFounderOutreachSummary(input: AgentMailFounderSummaryInput): Promise<string> {
  return sendWithAgentMail(input);
}
