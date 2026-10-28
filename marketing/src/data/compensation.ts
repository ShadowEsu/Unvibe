export type CompensationKind = "cash";

export interface CompensationLine {
  name: string;
  amountUsd: number;
  detail: string;
  kind: CompensationKind;
  state: string;
}

/** Public, self-reported committed cash only; not a complete account of company resources. */
export const compensationLines: CompensationLine[] = [
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

export interface StartupProgram {
  /** Brand name as used in the one-line summary. */
  brand: string;
  /** Full program name, exactly as in the acceptance email. */
  program: string;
  /** Acceptance email date. */
  accepted: string;
  /** Official, unmodified logo file. Only programs whose terms allow it (MongoDB); the rest are plain text. */
  logo?: string;
  /** Registered mark that takes "®" at its first use on each page (MongoDB Trademark Standard 3). */
  registered?: string;
}

/**
 * The startup programs Unvibe is in: only those with an acceptance email on file (BOSS inbox check, 28 Oct 2026).
 * Names only. Never add credit amounts or a total; the homepage, /investors, /about, /kit and the milestones read this list.
 */
export const startupPrograms: readonly StartupProgram[] = [
  { brand: "PostHog", program: "PostHog for Startups", accepted: "2026-08-17" },
  { brand: "Mixpanel", program: "Mixpanel for Startups", accepted: "2026-08-18" },
  { brand: "Salesforce Launchpad", program: "Salesforce Launchpad", accepted: "2026-08-26" },
  { brand: "Deepgram", program: "Deepgram Startup Program", accepted: "2026-08-19" },
  { brand: "MongoDB", program: "MongoDB for Startups", accepted: "2026-07-21", logo: "/sponsors/mongodb-logo.svg", registered: "MongoDB" },
];

/** Salesforce's required attribution, shown wherever the Salesforce name appears. */
export const SALESFORCE_ATTRIBUTION = "Salesforce is a trademark of Salesforce, Inc.";

/** `text` with the program's registered mark as "Mark®", for the first use of the name on a page. */
export function withRegistration(text: string, program: StartupProgram): string {
  return program.registered ? text.replace(program.registered, `${program.registered}®`) : text;
}

/**
 * "In 5 startup programs: PostHog, Mixpanel, Salesforce Launchpad, Deepgram and MongoDB®".
 * Always a first use of the names, so registered marks carry ®.
 */
export function startupProgramsLine(): string {
  const names = startupPrograms.map((program) => withRegistration(program.brand, program));
  return `In ${names.length} startup programs: ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function compensationTotalUsd(): number {
  return compensationLines.reduce((sum, line) => sum + line.amountUsd, 0);
}

export function compensationTotalLabel(): string {
  return formatUsd(compensationTotalUsd());
}
