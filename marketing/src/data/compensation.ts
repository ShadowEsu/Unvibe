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
  /** Acceptance date (the welcome email where there is one, else the date the earlier site gave). */
  accepted: string;
  /**
   * Credit value as the earlier site listed it (self-reported), only where a record supports it. A program
   * with no supported amount is listed by name and adds nothing to the totals. Credits are not cash.
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
 * The startup programs Unvibe is in, as the earlier site listed them (ledger 317, 28 Oct 2026), minus the lines
 * the record does not support (Security 31 Oct, requests/security/20261031-0208: GitLab and Linear removed,
 * Deepgram without an amount). Amounts are self-reported; logos and notices follow Security's 28 Oct ruling
 * (only MongoDB shows a logo). The homepage, /investors, /about, /kit and the milestones all read this list,
 * so a change is one line.
 */
export const startupPrograms: readonly StartupProgram[] = [
  {
    brand: "Claude for Startups",
    program: "Claude for Startups",
    accepted: "2026-10-07",
    amountUsd: 21_500,
    detail: "Anthropic API credits, Claude Team for 12 months, and perks from other tools. Low end of a $21.5K to $23K estimate",
  },
  { brand: "Mixpanel", program: "Mixpanel for Startups", accepted: "2026-08-18", amountUsd: 144_000, detail: "1 year Mixpanel Pro plan credits" },
  { brand: "PostHog", program: "PostHog for Startups", accepted: "2026-08-17", amountUsd: 50_000, detail: "PostHog credits" },
  {
    brand: "Salesforce Launchpad",
    program: "Salesforce Launchpad",
    accepted: "2026-08-26",
    amountUsd: 13_500,
    detail: "30 Starter Suite seats, confirmed 2-year program value",
  },
  { brand: "Google for Startups", program: "Google for Startups", accepted: "2026-07-23", amountUsd: 2_000, detail: "Google Cloud credits, USD" },
  { brand: "OpenAI", program: "OpenAI for Startups", accepted: "2026-08-16", amountUsd: 1_200, detail: "ChatGPT Business seat credits" },
  { brand: "Deepgram", program: "Deepgram Startup Program", accepted: "2026-08-19", detail: "Deepgram API credits" },
  {
    brand: "MongoDB",
    program: "MongoDB for Startups",
    accepted: "2026-07-21",
    amountUsd: 500,
    detail: "Program support",
    logo: { src: "/sponsors/mongodb-logo.svg", width: 1102, height: 278 },
    mark: { name: "MongoDB", symbol: "®" },
  },
];

/** Program credits where an amount is supported, then self-reported cash. Credits are not cash and not a funding round. */
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

/** Startup programs are the credit lines only. Own capital and angel cash are not programs. */
export function compensationProgramCount(): number {
  return startupPrograms.length;
}
