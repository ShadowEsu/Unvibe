import { SHORTCUTS } from "@/lib/shortcuts";

/**
 * What Unvibe is, in the words people type into a search box or ask an AI assistant ("explain
 * AI-written code in plain English"). One source for the home title and description, the JSON-LD,
 * /llms.txt and /llms-full.txt, so they never disagree. Every line must be true of the shipped app
 * (honest-conversion-claims): each feature below is also stated in data/faq.ts.
 */
export const PRODUCT_PHRASE = "Explain AI-written code in plain English";

/** The entity sentence: what it is, for whom, on which computers, at what price. */
export const PRODUCT_SENTENCE =
  "Unvibe is a free desktop app for Mac and Windows that explains AI-written code in plain English.";

/** How you use it, with the real shortcuts. */
export const PRODUCT_HOW = `Select code in any app, press ${SHORTCUTS.mac.anywhere} (${SHORTCUTS.windows.anywhere} on Windows), and a panel beside your editor explains it at the depth you pick.`;

export const PRODUCT_FEATURES: readonly string[] = [
  "Explains code you select in any app, including Cursor, VS Code, Xcode, Terminal and your browser",
  "Five depths: New, Beginner, Intermediate and Advanced are free; Expert is part of Pro",
  "Follow-up questions about the same code",
  "Test me: up to 3 questions about the code you just read",
  "A Library of saved lessons and a small daily goal on the Today page",
  "Briefs that recap your git changes",
  "Checks the code for keys and tokens on your computer before anything is sent",
];
