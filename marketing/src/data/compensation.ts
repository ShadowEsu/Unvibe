export type CompensationKind = "credits" | "cash";

export interface CompensationLine {
  name: string;
  amountUsd: number;
  detail: string;
  kind: CompensationKind;
  state: string;
}

/** Program credits and founder-reported cash. Credits are not a funding round. */
export const compensationLines: CompensationLine[] = [
  {
    name: "Mixpanel for Startups",
    amountUsd: 144_000,
    detail: "1 year Mixpanel Pro plan credits",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "PostHog for Startups",
    amountUsd: 50_000,
    detail: "PostHog credits",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "GitLab for Startups",
    amountUsd: 23_700,
    detail: "GitLab Ultimate credits",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "AWS for Startups",
    amountUsd: 5_000,
    detail: "AWS Activate credits",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "Linear Founder Value Pack",
    amountUsd: 4_500,
    detail: "Six months of Linear",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "Google AI Startups",
    amountUsd: 2_000,
    detail: "Google Cloud credits, USD",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "OpenAI for Startups",
    amountUsd: 1_200,
    detail: "ChatGPT Business seat credits",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "Deepgram for Startups",
    amountUsd: 1_000,
    detail: "Deepgram API credits",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "MongoDB for Startups",
    amountUsd: 500,
    detail: "Program support",
    kind: "credits",
    state: "Secured",
  },
  {
    name: "Founder capital",
    amountUsd: 500,
    detail: "Committed cash",
    kind: "cash",
    state: "Committed",
  },
  {
    name: "Early angel support",
    amountUsd: 300,
    detail: "Founder-reported committed cash",
    kind: "cash",
    state: "Founder-reported",
  },
];

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

export function compensationCreditsUsd(): number {
  return compensationLines
    .filter((line) => line.kind === "credits")
    .reduce((sum, line) => sum + line.amountUsd, 0);
}

export function compensationCashUsd(): number {
  return compensationLines
    .filter((line) => line.kind === "cash")
    .reduce((sum, line) => sum + line.amountUsd, 0);
}

export function compensationTotalLabel(): string {
  return formatUsd(compensationTotalUsd());
}
