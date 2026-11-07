export type CompensationKind = "credits" | "cash";

export interface CompensationLine {
  name: string;
  amountUsd: number;
  detail: string;
  kind: CompensationKind;
  state: string;
}

export interface StartupProgram {
  /** Short name for the one-line summaries. */
  brand: string;
  /** Full program name as shown in lists. */
  program: string;
  /** Acceptance date (the company's first welcome or approval email). */
  accepted: string;
  /**
   * Credit or plan value, counted in the totals. A program without one is listed by name and terms and adds nothing.
   * Credits are not cash.
   */
  amountUsd?: number;
  detail: string;
  /** Official, unmodified logo file, only where Security has cleared it (MongoDB); every other program is plain text. */
  logo?: { src: string; width: number; height: number };
  /** Mark that takes its notice ("®" registered, "™" otherwise) at its first use on each page. */
  mark?: { name: string; symbol: "®" | "™" };
}

/** Salesforce's required attribution, shown wherever the Salesforce name appears. */
export const SALESFORCE_ATTRIBUTION = "Salesforce is a trademark of Salesforce, Inc.";
/** Every attribution line a named brand requires, for the fine print wherever the program list appears. */
export const PROGRAM_NOTICES = [SALESFORCE_ATTRIBUTION] as const;

/**
 * The startup programs Unvibe is in, as the earlier site listed them (ledger 317, 28 Oct 2026), minus GitLab,
 * Linear and OpenAI (Security 31 Oct, requests/security/20261031-0208). Amounts: the owner's attestation that each
 * company confirmed its figure by phone (ledger 559, Security file 20261106-1844, 7 Nov 03:24Z), plus the emails
 * noted per line. Logos and notices follow Security's 28 Oct ruling (only MongoDB shows a logo). The homepage,
 * /investors, /about, /kit and the milestones all read this list, so a change is one line.
 */
export const startupPrograms: readonly StartupProgram[] = [
  // Preston attests: confirmed by phone with the company, 6 Nov 2026. Membership: Anthropic's "Welcome to Claude for
  // Startups" email, 17 Jul 2026.
  {
    brand: "Claude for Startups",
    program: "Claude for Startups",
    accepted: "2026-07-17",
    amountUsd: 21_500,
    detail: "Anthropic API credits, Claude Team for 12 months, and perks from other tools",
  },
  // Preston attests: confirmed by phone with the company, 6 Nov 2026. Terms: startups@mixpanel.com, 18 Aug 2026,
  // "your first year free on the Startup Plan".
  { brand: "Mixpanel", program: "Mixpanel for Startups", accepted: "2026-08-18", amountUsd: 144_000, detail: "1 year of Mixpanel's Startup Plan" },
  { brand: "PostHog", program: "PostHog for Startups", accepted: "2026-08-17", amountUsd: 50_000, detail: "PostHog credits" },
  // Preston attests: confirmed by phone with the company, 6 Nov 2026. Terms: Salesforce benefits email, 26 Aug 2026,
  // "we're funding your Starter for the next 12 months (and will be 50% off for your second year)".
  {
    brand: "Salesforce Launchpad",
    program: "Salesforce Launchpad",
    accepted: "2026-08-26",
    amountUsd: 13_500,
    detail: "12 months of Starter Suite funded by Salesforce, 50% off year 2",
  },
  // Google approval email (cloudstartupsupport-noreply@google.com), 24 Jul 2026: "$2,000 USD* in Google Cloud credits
  // to use over the next two years".
  {
    brand: "Google for Startups",
    program: "Google for Startups",
    accepted: "2026-07-24",
    amountUsd: 2_000,
    detail: "Google Cloud credits, to use over two years",
  },
  // Deepgram welcome email, 19 Aug 2026: "your initial $1k in free credit allocation". Any later batch is never shown.
  { brand: "Deepgram", program: "Deepgram Startup Program", accepted: "2026-08-19", amountUsd: 1_000, detail: "Deepgram API credits" },
  // Preston attests: confirmed by phone with the company, 6 Nov 2026. Acceptance: MongoDB email, 21 Jul 2026.
  {
    brand: "MongoDB",
    program: "MongoDB for Startups",
    accepted: "2026-07-21",
    amountUsd: 500,
    detail: "$500 in MongoDB Atlas credits",
    logo: { src: "/sponsors/mongodb-logo.svg", width: 1102, height: 278 },
    mark: { name: "MongoDB", symbol: "®" },
  },
];

/** Program credits and plan value, then self-reported cash. Credits are not cash and not a round. */
export const compensationLines: CompensationLine[] = [
  ...startupPrograms.flatMap((program): CompensationLine[] =>
    program.amountUsd === undefined
      ? []
      : [{ name: program.program, amountUsd: program.amountUsd, detail: program.detail, kind: "credits", state: "Secured" }],
  ),
  {
    name: "Own capital",
    amountUsd: 500,
    detail: "Committed cash",
    kind: "cash",
    state: "Committed",
  },
  {
    name: "Early angel support",
    amountUsd: 300,
    detail: "Self-reported committed cash",
    kind: "cash",
    state: "Self-reported",
  },
];

/** `text` with the program's mark notice ("MongoDB®"), for the first use of the name on a page. */
export function withMark(text: string, program: StartupProgram): string {
  return program.mark ? text.replace(program.mark.name, `${program.mark.name}${program.mark.symbol}`) : text;
}

/**
 * "In Claude for Startups, plus Mixpanel, PostHog, …, Deepgram and MongoDB®" (about-mission.md). Always a
 * first use of the names, so marks carry their notice.
 */
export function startupProgramsLine(): string {
  const [lead, ...rest] = startupPrograms.map((program) => withMark(program.brand, program));
  return `In ${lead}, plus ${rest.slice(0, -1).join(", ")} and ${rest[rest.length - 1]}`;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function sumUsd(kind?: CompensationKind): number {
  return compensationLines.filter((line) => !kind || line.kind === kind).reduce((sum, line) => sum + line.amountUsd, 0);
}

export function compensationTotalUsd(): number {
  return sumUsd();
}

export function compensationCreditsUsd(): number {
  return sumUsd("credits");
}

export function compensationCashUsd(): number {
  return sumUsd("cash");
}

export function compensationTotalLabel(): string {
  return formatUsd(compensationTotalUsd());
}

/** What the total is, after the amount (Security 1844 W4, which replaces CL-T1 now that every program has an amount). */
export function compensationTotalPhrase(): string {
  return "in startup-program credits and plan value, and committed cash";
}

/** Programs listed by name and terms with no amount, outside the total (none since ledger 559). */
export function programsOutsideTotalCount(): number {
  return startupPrograms.filter((program) => program.amountUsd === undefined).length;
}

export interface SupportRow {
  name: string;
  /** "$50,000", or "No amount" for a program whose terms are on record without a figure. */
  amount: string;
  detail: string;
  state: string;
}

/** Every source for the investors table and the kit: money lines by amount, then any program without an amount. */
export function supportRows(): SupportRow[] {
  const money = [...compensationLines]
    .sort((a, b) => b.amountUsd - a.amountUsd)
    .map((line) => ({ name: line.name, amount: formatUsd(line.amountUsd), detail: line.detail, state: line.state }));
  const terms = startupPrograms
    .filter((program) => program.amountUsd === undefined)
    .map((program) => ({ name: program.program, amount: "No amount", detail: program.detail, state: "Member" }));
  return [...money, ...terms];
}

/** Startup programs are the credit lines only. Own capital and angel cash are not programs. */
export function compensationProgramCount(): number {
  return startupPrograms.length;
}
