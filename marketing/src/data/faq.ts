import { BETA_WINDOWS_INSTALL_COMMAND } from "@/lib/betaOffer";
import { formatUsd } from "@/data/compensation";
import { BUSINESS_RATE_LIMIT_LINE, BUSINESS_SEATS, BUSINESS_UNLIMITED, EXPLANATIONS_PER_MONTH, FREE_LINE, PRICING, formatCount } from "@/lib/pricing";
import { SHORTCUTS } from "@/lib/shortcuts";

/**
 * FAQ content, kept short and true to the shipped app (app/src):
 * free public beta for Mac and Windows; selection based (no screen recording or OCR);
 * keys and tokens in code and diffs filtered on the device (typed questions and Chat too from
 * v0.1.44, not in v0.1.43); no local-only mode yet; AI explanations can be wrong.
 * Plans, prices and allowances come from lib/pricing. Plain text only: Big Business names its named seats,
 * its use with no monthly cap and its fair-use rate limit, and points to the Fair use section in words.
 */

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: "product" | "privacy" | "platform" | "pricing";
}

export const faqCategories: Record<FaqItem["category"], string> = {
  product: "Product",
  privacy: "Privacy & data",
  platform: "Platforms",
  pricing: "Access & pricing",
};

const { mac, windows } = SHORTCUTS;

export const faqItems: FaqItem[] = [
  {
    id: "what-is-it",
    question: "What is Unvibe?",
    answer: `A free desktop app for Mac and Windows. Select code in any app and press ${mac.anywhere} (${windows.anywhere} on Windows). A panel beside your editor explains it at the depth you pick. Ask follow-ups, take a one-question Test me, and save the lesson to your Library.`,
    category: "product",
  },
  {
    id: "generator",
    question: "Is Unvibe a code generator?",
    answer: "No. Your AI tools write the code. Unvibe helps you understand, review and remember it.",
    category: "product",
  },
  {
    id: "vs-cursor",
    question: "Why not just ask the agent to explain itself?",
    answer:
      "Agent chat answers vanish when you move on. Unvibe opens beside the code, explains it at five depths, saves it to your Library and checks you got it with Test me.",
    category: "product",
  },
  {
    id: "editors",
    question: "Which apps does it work with?",
    answer: `Any app where you can select code: Cursor, VS Code, Xcode, Terminal, your browser and more. In Cursor and VS Code, an optional editor bridge adds ${mac.editor} (${windows.editor} on Windows).`,
    category: "platform",
  },
  {
    id: "which-shortcut",
    question: "Which shortcut do I press?",
    answer: `${mac.anywhere} on a Mac, ${windows.anywhere} on Windows, in any app. The first time on a Mac, allow Unvibe in System Settings › Privacy & Security › Accessibility so it can copy your selection. With the editor bridge (Settings › Integrations), ${mac.editor} or ${windows.editor} also works in VS Code and Cursor. You can change the shortcut in Settings.`,
    category: "product",
  },
  {
    id: "app-or-extension",
    question: "Is it an extension or an app?",
    answer:
      "A desktop app that runs beside your editor. When you press the shortcut it copies only your selection, plus the file name and language. Briefs read the git changes of a project on your computer. Keys and tokens in that code are filtered on your computer before it is sent.",
    category: "product",
  },
  {
    id: "screen",
    question: "Does it read my entire screen?",
    answer:
      "No. It never records your screen or uses OCR. It only sees the code you select, or the git changes you ask a Brief about.",
    category: "privacy",
  },
  {
    id: "sent",
    question: "What gets sent to the AI?",
    answer:
      "Only what you ask about: the selected code with its file name and language (with Pro, some nearby code for context), or the git changes in a Brief, plus any question you type. Keys and tokens in the code are filtered on your computer first, and from version 0.1.44 so are your questions and Chat messages. Your repo is never uploaded.",
    category: "privacy",
  },
  {
    id: "levels",
    question: "Can I choose the explanation level?",
    answer:
      "Yes. New, Beginner, Intermediate and Advanced are free. Expert is part of Pro. Switch any time and the same code is explained again at that depth.",
    category: "product",
  },
  {
    id: "repo",
    question: "Can it explain an entire repository?",
    answer:
      "Not in one go. It explains what you select, and Briefs recap git changes: your working tree, staged files, the latest commit or a branch. The whole codebase is never sent.",
    category: "product",
  },
  {
    id: "local-mode",
    question: "Is there a local-only mode?",
    answer:
      "Not yet. Explanations come from a cloud AI provider, after keys and tokens in your code are filtered on your computer.",
    category: "privacy",
  },
  {
    id: "training",
    question: "Will my code be used for training?",
    answer:
      "Unvibe doesn't build a training dataset from your code. During the beta, explanations come from the Google Gemini API, and Google's Gemini API terms decide how Google may use that content. The secret filter catches common keys and tokens, but no filter can promise to find every sensitive value.",
    category: "privacy",
  },
  {
    id: "free",
    question: "Is Free actually usable?",
    answer: `Yes. ${FREE_LINE}. It covers explanations at New through Advanced, follow-ups, Test me and your Library. Briefs of your Git changes and “Why does this exist?” are free too and run on your computer. A new account's first month is Pro. No card and no API key.`,
    category: "pricing",
  },
  {
    id: "plans",
    question: "What plans are there?",
    answer: `Four. ${FREE_LINE}. Pro: $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year, ${formatCount(EXPLANATIONS_PER_MONTH.pro)} explanations a month. Enterprise: $${PRICING.enterpriseMonthly} a month, ${formatCount(EXPLANATIONS_PER_MONTH.enterprise)} explanations a month, one account. Big Business: ${formatUsd(PRICING.businessOnce)} as one payment, up to ${BUSINESS_SEATS} people on ${BUSINESS_SEATS} named seats, ${BUSINESS_UNLIMITED}, under the ${BUSINESS_RATE_LIMIT_LINE}, as written in Fair use on the pricing page. Payments for Pro, Enterprise and Big Business open soon. Email hello@unvibe.site to apply.`,
    category: "pricing",
  },
  {
    id: "pro-annual",
    question: "Is Pro cheaper annually?",
    answer: `Yes. Pro is $${PRICING.proMonthly} a month, or $${PRICING.proAnnual} a year (${PRICING.annualDiscountPercent}% off). Enterprise is monthly only, and Big Business is one payment.`,
    category: "pricing",
  },
  {
    id: "cancel",
    question: "What happens if I cancel?",
    answer: "Pro stays on until the end of the billing period, then your account moves back to Free.",
    category: "pricing",
  },
  {
    id: "beta",
    question: "How do I get it?",
    answer:
      "Download it free from the Download page, for Mac (Apple silicon or Intel) or Windows 10 and 11 (x64). No card and no API key. On a phone? We can email you the link.",
    category: "pricing",
  },
  {
    id: "windows",
    question: "Is Windows supported?",
    answer: `Yes. Download the .exe from the Download page, or paste ${BETA_WINDOWS_INSTALL_COMMAND} into PowerShell. The app isn't signed yet, so SmartScreen may warn the first time. Then select code in any app and press ${windows.anywhere}.`,
    category: "platform",
  },
  {
    id: "groups",
    question: "Can a class or a group use it?",
    answer: `Everyone can use Unvibe free with their own account. Pro and Enterprise are one account each. Big Business covers up to ${BUSINESS_SEATS} people, each on a named seat. For a class or a group, email hello@unvibe.site.`,
    category: "platform",
  },
  {
    id: "delete",
    question: "Can I delete my account and data?",
    answer:
      "Yes. You can delete your account and the learning records synced to it. Data controls explains the process.",
    category: "privacy",
  },
  {
    id: "accuracy",
    question: "Can the explanations be wrong?",
    answer:
      "Yes. AI can be wrong even when it sounds sure. Each explanation sits next to the code it describes so you can check it, and Test me helps you spot what doesn't add up.",
    category: "product",
  },
];
