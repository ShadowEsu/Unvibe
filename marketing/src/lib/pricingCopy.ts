import { PRICING } from "@/lib/pricing";

/**
 * Pricing copy for both billing states. While payments are closed (see lib/paymentsStatus), prices
 * stay visible but nothing promises an upgrade, checkout or renewal. Once payments open, the
 * shipped copy returns. In both states Download free is the only filled button, and no plan
 * states an allowance number (Pro gets more explanations than Free; see web/src/billing/plans.ts).
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
  cta: string;
  href: string;
  featured: boolean;
  /** Filled button. Quiet (outlined) when false. */
  primary: boolean;
};

export type PricingCopy = {
  heading: { lead: string; emphasis: string; tail: string };
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
  pro: ["Everything in Free", "Expert depth", "AI explanations of Git diffs and change Briefs", "Answers that use nearby files", "More explanations each month than Free"],
  teams: ["One shared workspace", "Invites for your team", "Who reviewed what (metadata only)", SEATS],
} as const;

const free: PlanCopy = {
  id: "free",
  name: "Free",
  badge: "No card needed",
  eyebrow: "Understand the code in front of you.",
  price: "$0",
  detail: "Included AI explanations with a usage limit. No card and no separate API key.",
  features: FEATURES.free,
  cta: "Download free",
  href: "/beta",
  featured: false,
  primary: true,
};

const OPEN: PricingCopy = {
  heading: { lead: "Start free. Upgrade when it ", emphasis: "earns a place", tail: " in your day." },
  description: `Download Unvibe free. Pro is $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year and adds Expert depth, AI explanations of Git diffs and nearby-file context. Teams is a founding pilot at $${PRICING.teamsSeatMonthly} per seat per month.`,
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
  description: `Download Unvibe free today. Pro opens soon at $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year and adds Expert depth, AI explanations of Git diffs and nearby-file context. Teams is a founding pilot at $${PRICING.teamsSeatMonthly} per seat per month.`,
  plans: [
    free,
    { id: "pro", name: "Pro", badge: "Opens soon", eyebrow: "Go deeper and keep the context.", price: "", detail: "One developer account. Pro opens soon. Your Free plan keeps working until then.", features: FEATURES.pro, cta: "Download free", href: "/beta", featured: true, primary: false },
    { id: "teams", name: "Teams", badge: "Opens soon", eyebrow: "Share a workspace and see who reviewed what.", price: "", detail: `Teams opens soon. Until then, founding seats start by email. Founding price. ${SEATS}. Each person keeps their explanations on their own computer.`, features: FEATURES.teams, cta: "Email about Teams", href: TEAMS_MAILTO, featured: false, primary: false },
  ],
  disclosure: "Prices in USD. Pro and Teams are not on sale yet, so nothing is billed today. Explanation text is not shared across seats.",
  termsNote: "Pro and Teams are not on sale yet. Until they open, nothing is billed and your Free plan keeps working.",
};

export function pricingCopy(paymentsOpen: boolean): PricingCopy {
  return paymentsOpen ? OPEN : CLOSED;
}
