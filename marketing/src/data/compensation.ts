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
