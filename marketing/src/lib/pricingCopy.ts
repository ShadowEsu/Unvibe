import { formatUsd } from "@/data/compensation";
import { BUSINESS_RATE_LIMIT_LINE, BUSINESS_SEATS, BUSINESS_UNLIMITED, EXPLANATIONS_PER_MONTH, FAIR_USE_HREF, FREE_LINE, PRICING, REQUEST_SIZE_LIMIT, formatCount } from "@/lib/pricing";

/**
 * Pricing copy for both billing states. While payments are closed (see lib/paymentsStatus), prices
 * stay visible, nothing promises an upgrade, checkout or renewal, and Pro reads "Payments open
 * soon" with an application email. Enterprise and Big Business are never purchasable from the
 * site, whatever the payments status or the web flag (BILLING_NEW_TIERS_ENABLED): they always read
 * "Payments open soon" and link to an application email.
 * Download free is the only filled button. Allowances come from lib/pricing.
 */

export type PlanCopy = {
  id: "free" | "pro" | "enterprise" | "business";
  name: string;
  badge: string;
  eyebrow: string;
  /** Shown for Free and Big Business; Pro and Enterprise prices come from PRICING per interval. */
  price: string;
  /** The allowance: explanations a month, or for Big Business its seats, use with no monthly cap and the rate limit. When `allowanceHref` is set, FAIR_USE_LABEL in the line links there. */
  allowance: string;
  allowanceHref: string | null;
  /**
   * The end of `allowance` that qualifies the offer (Big Business: its fair-use rate limit). The card
   * sets it on its own line at regular weight; the words and the single paragraph stay the same.
   */
  allowanceLimit: string | null;
  detail: string;
  /** What the price includes. */
  features: readonly string[];
  /** Shown below the inclusions; never part of what is sold. */
  note: string | null;
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
  /** Extra Pro sentence for the Terms payments section; null once payments open. Enterprise and Big Business: TERMS_NEW_TIERS. */
  termsNote: string | null;
};

export const PAYMENTS_OPEN_SOON = "Payments open soon";

const PRO_MAILTO = "mailto:hello@unvibe.site?subject=Unvibe%20Pro%20application";
const ENTERPRISE_MAILTO = "mailto:hello@unvibe.site?subject=Unvibe%20Enterprise%20application";
const BUSINESS_MAILTO = "mailto:hello@unvibe.site?subject=Unvibe%20Big%20Business%20application";

const ENTERPRISE_PRICE = `$${PRICING.enterpriseMonthly} a month`;
const BUSINESS_PRICE = `${formatUsd(PRICING.businessOnce)} once`;

/** The written fair-use limit, shown on /pricing (id `fair-use`) and in the Terms. */
export const FAIR_USE = {
  heading: "Fair use",
  limit: `Big Business covers up to ${BUSINESS_SEATS} people, each on a named seat, with no monthly cap on explanations or questions. Its only usage limit is a ${BUSINESS_RATE_LIMIT_LINE}, with explanations and questions counted together. It is sized for one person working normally.`,
  enforcement: `When someone reaches it, the app says so and shows when they can try again: at the end of that minute or hour. Each request has the same size limit as every plan: up to ${formatCount(REQUEST_SIZE_LIMIT.codeCharacters)} characters of code and ${formatCount(REQUEST_SIZE_LIMIT.questionCharacters)} characters per question. No hidden throttling. Refunds and abuse follow the rest of the Terms.`,
} as const;

/** Terms payments section, after the Pro sentences. Both tiers stay closed on the site until payments open. */
export const TERMS_NEW_TIERS = `Enterprise (${ENTERPRISE_PRICE}) and Big Business (${BUSINESS_PRICE}) payments are not open yet. Once they open, Enterprise is billed monthly and renews until you cancel, and Big Business is a one-time payment that does not renew, for up to ${BUSINESS_SEATS} people on ${BUSINESS_SEATS} named seats. A seat is one person's named account and frees only when that person is removed from the workspace; seats do not rotate automatically.`;

const FEATURES = {
  free: ["Explain code you select in any app", "New, Beginner, Intermediate and Advanced depths", "Follow-ups and Test me", "Lessons saved to your Library", "Briefs of your Git changes, made on your computer", "“Why does this exist?” from your Git history", "Keys and tokens in your code filtered on your device"],
  pro: ["Everything in Free", "Expert depth", "AI explanations of Git diffs and change Briefs", "Answers that use nearby files"],
  enterprise: ["Everything in Pro", "Monthly only, no annual plan"],
  business: ["Everything in Pro", "One payment, not a subscription"],
} as const;

const free: PlanCopy = {
  id: "free",
  name: "Free",
  badge: "No card needed",
  eyebrow: "Understand the code in front of you.",
  price: "$0",
  allowance: FREE_LINE,
  allowanceHref: null,
  allowanceLimit: null,
  detail: "No card and no separate API key. A new account's first month is Pro.",
  features: FEATURES.free,
  note: null,
  cta: "Download free",
  href: "/beta",
  featured: false,
  primary: true,
};

const proAllowance = `${formatCount(EXPLANATIONS_PER_MONTH.pro)} explanations a month`;

const enterprise: PlanCopy = {
  id: "enterprise",
  name: "Enterprise",
  badge: PAYMENTS_OPEN_SOON,
  eyebrow: "Room for heavy daily use.",
  price: "",
  allowance: `${formatCount(EXPLANATIONS_PER_MONTH.enterprise)} explanations a month, one account`,
  allowanceHref: null,
  allowanceLimit: null,
  detail: "One account, no shared seats. Email us to apply and we write back when it opens.",
  features: FEATURES.enterprise,
  note: null,
  cta: "Apply by email",
  href: ENTERPRISE_MAILTO,
  featured: false,
  primary: false,
};

const businessAllowanceLimit = `under a ${BUSINESS_RATE_LIMIT_LINE}`;

const business: PlanCopy = {
  id: "business",
  name: "Big Business",
  badge: PAYMENTS_OPEN_SOON,
  eyebrow: "The most room of any plan.",
  price: formatUsd(PRICING.businessOnce),
  allowance: `Up to ${BUSINESS_SEATS} named seats, ${BUSINESS_UNLIMITED}, ${businessAllowanceLimit}`,
  allowanceHref: FAIR_USE_HREF,
  allowanceLimit: businessAllowanceLimit,
  detail: `One named account for each of up to ${BUSINESS_SEATS} people. Email us to apply and we write back when it opens.`,
  features: FEATURES.business,
  note: null,
  cta: "Apply by email",
  href: BUSINESS_MAILTO,
  featured: false,
  primary: false,
};

const NEW_TIERS = `Enterprise (${ENTERPRISE_PRICE}) and Big Business (${BUSINESS_PRICE})`;

const OPEN: PricingCopy = {
  heading: { lead: "Start free. Upgrade when it ", emphasis: "earns a place", tail: " in your day." },
  description: `Download Unvibe free. Pro is $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year and adds Expert depth, AI explanations of Git diffs and nearby-file context. ${NEW_TIERS} open soon.`,
  plans: [
    free,
    { id: "pro", name: "Pro", badge: "Individual", eyebrow: "Go deeper and keep the context.", price: "", allowance: proAllowance, allowanceHref: null, allowanceLimit: null, detail: "One developer account. Upgrade, manage or cancel from the Plan page in the app.", features: FEATURES.pro, note: null, cta: "Download, then upgrade", href: "/beta", featured: true, primary: false },
    enterprise,
    business,
  ],
  disclosure: "Prices in USD. Pro renews until you cancel. Enterprise and Big Business are not on sale yet, so nothing is billed for them today. Big Business will be one payment, not a subscription.",
  termsNote: null,
};

const CLOSED: PricingCopy = {
  heading: { lead: "Start free today. Paid plans ", emphasis: "open soon", tail: "." },
  description: `Download Unvibe free today. ${PAYMENTS_OPEN_SOON}. Pro is $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year and adds Expert depth, AI explanations of Git diffs and nearby-file context. ${NEW_TIERS} are not on sale yet either.`,
  plans: [
    free,
    { id: "pro", name: "Pro", badge: PAYMENTS_OPEN_SOON, eyebrow: "Go deeper and keep the context.", price: "", allowance: proAllowance, allowanceHref: null, allowanceLimit: null, detail: "One developer account. Your Free plan keeps working until payments open.", features: FEATURES.pro, note: null, cta: "Apply by email", href: PRO_MAILTO, featured: true, primary: false },
    enterprise,
    business,
  ],
  disclosure: "Prices in USD. Pro, Enterprise and Big Business are not on sale yet, so nothing is billed today. Big Business will be one payment, not a subscription.",
  termsNote: "Pro is not on sale yet. Until it opens, nothing is billed and your Free plan keeps working.",
};

export function pricingCopy(paymentsOpen: boolean): PricingCopy {
  return paymentsOpen ? OPEN : CLOSED;
}
