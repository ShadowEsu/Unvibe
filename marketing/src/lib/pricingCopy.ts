import { FREE_MONTHLY_ALLOWANCE, PRO_MONTHLY_ALLOWANCE, SIGNED_OUT_ALLOWANCE } from "@/lib/allowance";
import { PRICING } from "@/lib/pricing";

/**
 * Pricing copy for both billing states. While payments are closed (see lib/paymentsStatus), prices
 * stay visible but nothing promises an upgrade, checkout or renewal. Once payments open, the
 * shipped copy returns. In both states Download free is the only filled button. Allowance numbers
 * come only from lib/allowance.
 */

export type PlanCopy = {
  id: "free" | "pro" | "teams";
  name: string;
  badge: string;
  eyebrow: string;
  /** Shown for Free; Pro and Teams prices come from PRICING per interval. */
  price: string;
  detail: string;
  features: readonly string[];
  /** The card's button; null for a card with nothing to act on yet (Pro while it isn't on sale). */
  cta: string | null;
  href: string | null;
  /** A short line under the price. */
  note?: string;
  /** A line under the feature list. */
  after?: string;
  featured: boolean;
  /** Filled button. Quiet (outlined) when false. */
  primary: boolean;
};

export type PricingCopy = {
  heading: { lead: string; emphasis: string; tail: string };
  /** The /pricing meta description (search results cut at about 160 characters). Not shown on the page. */
  description: string;
  plans: readonly PlanCopy[];
  disclosure: string;
  /** Extra sentence for the Terms payments section; null once payments open. */
  termsNote: string | null;
};

const TEAMS_MAILTO =
  "mailto:hello@unvibe.site?subject=Unvibe%20Teams%20founding%20pilot&body=Company%20email%3A%20%0ASeats%20wanted%20(2%E2%80%9320)%3A%20%0A%0AWe%20want%20the%20Teams%20founding%20pilot%20(workspace%20%2B%20who%20reviewed%20what).";

const SEATS = `${PRICING.teamsMinSeats} to ${PRICING.teamsMaxSeats} seats`;

const FEATURES = {
  free: ["Explain code you select in any app", "New, Beginner, Intermediate and Advanced depths", "Follow-ups and Test me", "Lessons saved to your Library", "Briefs of your Git changes, made on your computer", "“Why does this exist?” from your Git history", "Keys and tokens in your code filtered on your device"],
  pro: ["Everything in Free", "Expert depth", "AI explanations of Git diffs and change Briefs", "Answers that use nearby files", PRO_MONTHLY_ALLOWANCE],
  teams: ["One shared workspace", "Invites for your team", "Who reviewed what (metadata only)", SEATS],
} as const;

const free: PlanCopy = {
  id: "free",
  name: "Free",
  badge: "No card needed",
  eyebrow: "Understand the code in front of you.",
  price: "$0",
  detail: `${SIGNED_OUT_ALLOWANCE}, then ${FREE_MONTHLY_ALLOWANCE} when you sign in. No card and no separate API key.`,
  features: FEATURES.free,
  cta: "Download free",
  href: "/beta",
  featured: false,
  primary: true,
};

const OPEN: PricingCopy = {
  heading: { lead: "Start free. Upgrade when it ", emphasis: "earns a place", tail: " in your day." },
  description: `Unvibe is free to download and use, with no card. Pro adds the Expert depth for $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year.`,
  plans: [
    free,
    { id: "pro", name: "Pro", badge: "Individual", eyebrow: "Go deeper and keep the context.", price: "", detail: "One developer account. Upgrade, manage or cancel from the Plan page in the app.", features: FEATURES.pro, cta: "Download, then upgrade", href: "/beta", featured: true, primary: false },
    { id: "teams", name: "Teams", badge: "Founding pilot", eyebrow: "Share a workspace and see who reviewed what.", price: "", detail: `Founding price. ${SEATS}. Each person keeps their explanations on their own computer.`, features: FEATURES.teams, cta: "Request Teams seats", href: TEAMS_MAILTO, featured: false, primary: false },
  ],
  disclosure: "Prices in USD. Pro and Teams renew until you cancel. “Founding pilot” means early access, not general availability. Explanation text is not shared across seats.",
  termsNote: null,
};

const CLOSED: PricingCopy = {
  heading: { lead: "Start free today. Pro and Teams ", emphasis: "open soon", tail: "." },
  description: `Unvibe is free to download and use, with no card. Pro adds the Expert depth for $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year; payments open soon.`,
  plans: [
    free,
    // Lead, 31 Oct: this card already says "Not on sale yet" under the price, so its line under the list is the "try it" half only.
    { id: "pro", name: "Pro", badge: "Individual", eyebrow: "Go deeper and keep the context.", price: "", note: "Not on sale yet", detail: "One developer account. Your Free plan keeps working until then.", features: FEATURES.pro, after: "Try Pro today: a new account gets a free month, and each friend you invite adds one.", cta: null, href: null, featured: true, primary: false },
    { id: "teams", name: "Teams", badge: "Founding pilot", eyebrow: "Share a workspace and see who reviewed what.", price: "", note: "Not on sale yet", detail: `Founding seats start by email. Founding price. ${SEATS}. Each person keeps their explanations on their own computer.`, features: FEATURES.teams, cta: "Email about Teams", href: TEAMS_MAILTO, featured: false, primary: false },
  ],
  disclosure: "Prices in USD. Pro and Teams are not on sale yet, so nothing is billed today. Explanation text is not shared across seats.",
  termsNote: "Pro and Teams are not on sale yet. Until they open, nothing is billed and your Free plan keeps working.",
};

export function pricingCopy(paymentsOpen: boolean): PricingCopy {
  return paymentsOpen ? OPEN : CLOSED;
}
