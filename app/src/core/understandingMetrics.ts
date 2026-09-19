export type EvidenceKind =
  | 'viewed'
  | 'followup'
  | 'confirmed'
  | 'quiz'
  | 'teachback'
  | 'authored';

const WEIGHT: Record<EvidenceKind, number> = {
  viewed: 8,
  followup: 16,
  confirmed: 18,
  quiz: 22,
  teachback: 24,
  authored: 12,
};

export function coverageFromEvidence(kinds: EvidenceKind[]): { score: number | null; why: string[] } {
  if (kinds.length === 0) {
    return { score: null, why: ['Not enough evidence yet to calculate Understanding Coverage.'] };
  }
  const unique = [...new Set(kinds)];
  const raw = unique.reduce((sum, kind) => sum + WEIGHT[kind], 0);
  const score = Math.min(97, raw);
  const why = unique.map((kind) => `${kind}: ${WEIGHT[kind]}`);
  return { score, why };
}

export function knowledgeRisk(input: {
  missing: number;
  concentration: number;
  stale: number;
  unreviewed: number;
}): { score: number; label: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; note: string } {
  const score = Math.round(
    input.missing * 0.35 + input.concentration * 0.3 + input.stale * 0.2 + input.unreviewed * 0.15,
  );
  const clamped = Math.min(100, Math.max(0, score));
  const label = clamped <= 24 ? 'LOW' : clamped <= 49 ? 'MEDIUM' : clamped <= 74 ? 'HIGH' : 'CRITICAL';
  return {
    score: clamped,
    label,
    note: 'Directional product metric. Formula: 35% missing + 30% concentration + 20% stale + 15% unreviewed.',
  };
}

export function understandingGap(codeVelocity: number, understandingVelocity: number): number {
  return Math.round(codeVelocity - understandingVelocity);
}
