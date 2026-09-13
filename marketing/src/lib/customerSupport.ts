export type CustomerSupportCategory = "waitlist" | "product" | "setup" | "feedback" | "billing" | "account" | "privacy" | "bug" | "unknown";
export type CustomerSupportDecision = "auto_reply" | "draft" | "suppress";

export interface CustomerSupportResponse {
  category: CustomerSupportCategory;
  decision: CustomerSupportDecision;
  reason: string;
  subject: string;
  text: string;
}

function replySubject(subject?: string): string {
  const cleaned = subject?.replace(/[\r\n]+/g, " ").trim().slice(0, 160);
  return cleaned ? `Re: ${cleaned}` : "Re: Unvibe";
}

function reply(subject: string | undefined, content: string): Pick<CustomerSupportResponse, "subject" | "text"> {
  return {
    subject: replySubject(subject),
    text: `Hi!\n\n${content}\n\nWebsite: https://unvibe.site\n\n— Preston, Unvibe`,
  };
}

function normalized(subject?: string, text?: string): string {
  return `${subject ?? ""}\n${text ?? ""}`.toLowerCase();
}

/**
 * Keep automatic support intentionally narrow. This is a deterministic policy,
 * not an AI agent: anything that could require account access, a promise, or a
 * technical diagnosis is queued for the founder rather than guessed at.
 */
export function prepareCustomerSupportResponse(input: { subject?: string; text?: string }): CustomerSupportResponse {
  const value = normalized(input.subject, input.text);
  if (/\b(stop|unsubscribe|remove\s+me|do\s+not\s+contact|opt[\s-]?out)\b/i.test(value)) {
    return { category: "unknown", decision: "suppress", reason: "Sender requested no further contact.", ...reply(input.subject, "") };
  }

  if (/\b(refund|charge|charged|invoice|receipt|card|payment|billing|subscription|cancel\s+(?:my\s+)?plan|stripe)\b/i.test(value)) {
    return { category: "billing", decision: "draft", reason: "Billing or subscription request needs a founder review.", ...reply(input.subject, "") };
  }
  if (/\b(log\s*in|login|sign[\s-]?in|google|oauth|password|verification|account|email\s+change)\b/i.test(value)) {
    return { category: "account", decision: "draft", reason: "Account access request needs a founder review.", ...reply(input.subject, "") };
  }
  if (/\b(privacy|delete\s+(?:my\s+)?data|data\s+request|security|breach|token|api\s*key)\b/i.test(value)) {
    return { category: "privacy", decision: "draft", reason: "Privacy or security request needs a founder review.", ...reply(input.subject, "") };
  }
  if (/\b(bug|crash|broken|not\s+work(?:ing)?|error|issue|failed|freeze|stuck)\b/i.test(value)) {
    return { category: "bug", decision: "draft", reason: "Technical issue needs a reproducible founder review.", ...reply(input.subject, "") };
  }
  if (/\b(waitlist|beta|early\s+access|invite|when\s+(?:can|will)\s+i\s+(?:get|try)|download)\b/i.test(value)) {
    return {
      category: "waitlist",
      decision: "auto_reply",
      reason: "Routine private-beta access question.",
      ...reply(input.subject, "Thanks for your interest in Unvibe. We are currently inviting people into the private beta in stages. Joining the waitlist is the best way to receive access updates and the next available beta details."),
    };
  }
  if (/\b(what\s+is\s+unvibe|what\s+does\s+unvibe|how\s+does\s+it\s+work|explain(?:s|ing)?\s+code|ai[ -]generated\s+code)\b/i.test(value)) {
    return {
      category: "product",
      decision: "auto_reply",
      reason: "Routine product explanation question.",
      ...reply(input.subject, "Unvibe is a Mac-first code-comprehension companion for AI-generated code. You select the part you want to understand, receive a structured explanation, and can ask a follow-up or test your understanding so the work stays yours."),
    };
  }
  if (/\b(thanks|thank\s+you|love\s+it|great\s+idea|feedback|suggestion)\b/i.test(value)) {
    return {
      category: "feedback",
      decision: "auto_reply",
      reason: "General feedback or thanks.",
      ...reply(input.subject, "Thank you — I really appreciate you taking the time to write. Feedback from people building with AI directly shapes what Unvibe improves next."),
    };
  }
  if (/\b(command\s*\+?\s*u|⌘\s*u|shortcut|accessibility|select(?:ed|ing)?\s+code)\b/i.test(value)) {
    return {
      category: "setup",
      decision: "auto_reply",
      reason: "Routine shortcut setup question.",
      ...reply(input.subject, "For the core flow, select code in your editor and press ⌘U. If the shortcut is not opening Unvibe, reopening the app and checking its Accessibility permission are good first steps. Reply with your editor, macOS version, and app version if you still need help."),
    };
  }

  return { category: "unknown", decision: "draft", reason: "Question is unclear or outside the verified support answers.", ...reply(input.subject, "") };
}

