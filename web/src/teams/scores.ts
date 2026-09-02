/**
 * Unvibe Teams scoring — v1 heuristics.
 *
 * Rules from the Teams Intelligence Roadmap AI Build Spec:
 *   - Every score returns component values, weights, sample size, and
 *     evidence count so a "Why this score?" affordance can render the
 *     breakdown without another query.
 *   - When the evidence is insufficient the function returns
 *     { insufficientData: true } instead of manufacturing a percentage.
 *   - Viewing a PR contributes little; walkthrough / verification / recall
 *     contribute more. Weights are the single knob to tune.
 *   - Freshness decay is applied per-piece-of-evidence here, not by mutating
 *     rows in the database.
 *   - No score is scientifically precise. Values are directional.
 */

export type EvidenceKind =
  | 'pr_viewed'
  | 'pr_walkthrough'
  | 'pr_verified'
  | 'explanation_viewed'
  | 'explanation_saved'
  | 'concept_seen'
  | 'concept_verified'
  | 'quiz_correct'
  | 'quiz_incorrect'
  | 'commit_authored'
  | 'file_touched';

export type EvidenceRefKind = 'repo' | 'pr' | 'concept' | 'file' | 'commit' | 'system';

export interface EvidenceRecord {
  id: string;
  orgId: string;
  userId: string | null;
  kind: EvidenceKind;
  refKind: EvidenceRefKind;
  refId: string;
  /** Raw contribution weight. Combined with the kind weight in `weightFor()`. */
  weight: number;
  occurredAt: string;
  source: 'app' | 'github' | 'manual';
}

export interface ScoreExplanation {
  value: number | null;
  components: Array<{ label: string; contribution: number; weight: number }>;
  sampleSize: number;
  evidenceCount: number;
  insufficientData: boolean;
  reason?: string;
  /** Timestamp of the newest piece of evidence that fed the score. */
  freshnessAnchor?: string;
}

/**
 * Per-kind weights. Walkthrough > view; verification > walkthrough.
 * Tune only these constants — never fudge inside a computation.
 */
const KIND_WEIGHT: Record<EvidenceKind, number> = {
  pr_viewed: 0.15,
  pr_walkthrough: 0.55,
  pr_verified: 1.0,
  explanation_viewed: 0.15,
  explanation_saved: 0.4,
  concept_seen: 0.15,
  concept_verified: 0.9,
  quiz_correct: 0.6,
  quiz_incorrect: 0.1,
  commit_authored: 0.35,
  file_touched: 0.1,
};

/**
 * Minimum evidence rows required for a scope to produce a real score. Below
 * this threshold the function returns insufficientData=true and the UI shows
 * "Not enough data yet" instead of a manufactured percentage.
 */
const MIN_EVIDENCE: Record<'organization' | 'repository' | 'member' | 'concept', number> = {
  organization: 20,
  repository: 6,
  member: 3,
  concept: 2,
};

/**
 * Freshness decay: evidence older than the half-life contributes half as much.
 * Major code changes should shorten this further at a higher layer (per the
 * roadmap's Phase 7). This function only applies the time-based decay.
 */
const FRESHNESS_HALF_LIFE_DAYS = 30;

export function weightFor(evidence: EvidenceRecord): number {
  return Math.max(0, evidence.weight * (KIND_WEIGHT[evidence.kind] ?? 0));
}

export function freshnessMultiplier(occurredAt: string, now: Date = new Date()): number {
  const days = Math.max(0, (now.getTime() - new Date(occurredAt).getTime()) / 86_400_000);
  return Math.pow(0.5, days / FRESHNESS_HALF_LIFE_DAYS);
}

function effectiveWeight(evidence: EvidenceRecord, now: Date = new Date()): number {
  return weightFor(evidence) * freshnessMultiplier(evidence.occurredAt, now);
}

function newestAnchor(evidence: EvidenceRecord[]): string | undefined {
  let best: string | undefined;
  for (const e of evidence) {
    if (!best || e.occurredAt > best) best = e.occurredAt;
  }
  return best;
}

/**
 * Understanding coverage for a single repository. Combines PR understanding,
 * concept verification, walkthrough completion, and recent authorship into a
 * 0-100 directional score.
 */
export function computeRepoUnderstanding(
  evidence: EvidenceRecord[],
  now: Date = new Date(),
): ScoreExplanation {
  // Caller pre-filters evidence to this repository. All kinds contribute:
  // a concept verified while reading this repo counts, a commit to it counts,
  // a PR walkthrough counts. What separates them is `weight`, not refKind.
  const relevant = evidence;
  if (relevant.length < MIN_EVIDENCE.repository) {
    return {
      value: null,
      components: [],
      sampleSize: relevant.length,
      evidenceCount: relevant.length,
      insufficientData: true,
      reason: `Needs at least ${MIN_EVIDENCE.repository} pieces of evidence; has ${relevant.length}.`,
    };
  }

  const bucketWeight = (kinds: EvidenceKind[]): number =>
    relevant.filter((e) => kinds.includes(e.kind)).reduce((sum, e) => sum + effectiveWeight(e, now), 0);

  const prBucket = bucketWeight(['pr_walkthrough', 'pr_verified', 'pr_viewed']);
  const conceptBucket = bucketWeight(['concept_verified', 'concept_seen']);
  const authorshipBucket = bucketWeight(['commit_authored', 'file_touched']);
  const explanationBucket = bucketWeight(['explanation_saved', 'explanation_viewed']);

  // Simple normalization: each bucket is capped so no single dimension can
  // carry a repository to 100. Caps chosen to reflect the roadmap's rule that
  // no single kind of activity should imply full understanding on its own.
  const CAP = 40;
  const components = [
    { label: 'PR understanding', contribution: Math.min(CAP, prBucket), weight: KIND_WEIGHT.pr_walkthrough },
    { label: 'Concept coverage', contribution: Math.min(CAP, conceptBucket), weight: KIND_WEIGHT.concept_verified },
    { label: 'Recent authorship', contribution: Math.min(CAP * 0.5, authorshipBucket), weight: KIND_WEIGHT.commit_authored },
    { label: 'Explanations', contribution: Math.min(CAP * 0.5, explanationBucket), weight: KIND_WEIGHT.explanation_saved },
  ];

  const total = components.reduce((sum, c) => sum + c.contribution, 0);
  const value = Math.round(Math.min(100, (total / (CAP * 3)) * 100) * 100) / 100;

  return {
    value,
    components,
    sampleSize: relevant.length,
    evidenceCount: relevant.length,
    insufficientData: false,
    freshnessAnchor: newestAnchor(relevant),
  };
}

/**
 * Organization-wide overall understanding — weighted average of per-repository
 * understanding, weighted by repository sample size. Repositories with
 * insufficient data don't drag the mean down; they're simply not counted.
 */
export function computeOrgOverall(
  repoScores: Array<{ repoId: string; score: ScoreExplanation; weight?: number }>,
): ScoreExplanation {
  const counted = repoScores.filter((r) => !r.score.insufficientData && r.score.value != null);
  const totalEvidence = repoScores.reduce((sum, r) => sum + r.score.evidenceCount, 0);
  if (counted.length === 0 || totalEvidence < MIN_EVIDENCE.organization) {
    return {
      value: null,
      components: [],
      sampleSize: 0,
      evidenceCount: totalEvidence,
      insufficientData: true,
      reason: `Needs at least ${MIN_EVIDENCE.organization} total pieces of evidence across repositories.`,
    };
  }

  let weighted = 0;
  let weightSum = 0;
  const components: ScoreExplanation['components'] = [];
  for (const row of counted) {
    const w = row.weight ?? row.score.sampleSize;
    weighted += (row.score.value as number) * w;
    weightSum += w;
    components.push({ label: `Repo ${row.repoId}`, contribution: row.score.value as number, weight: w });
  }
  const value = weightSum === 0 ? 0 : Math.round((weighted / weightSum) * 100) / 100;

  return {
    value,
    components,
    sampleSize: counted.length,
    evidenceCount: totalEvidence,
    insufficientData: false,
    freshnessAnchor: repoScores.reduce<string | undefined>(
      (best, r) => (r.score.freshnessAnchor && (!best || r.score.freshnessAnchor > best) ? r.score.freshnessAnchor : best),
      undefined,
    ),
  };
}

/**
 * Knowledge concentration for a repository or system: the share of verified
 * evidence held by the top 1-2 context holders. Higher = more concentrated =
 * more risk. Kept as a share (0-100) so the UI can display it directly.
 * Uses raw distribution so the formula can evolve toward HHI/Gini later.
 */
export function computeKnowledgeConcentration(
  evidence: EvidenceRecord[],
): ScoreExplanation {
  const perUser = new Map<string, number>();
  for (const e of evidence) {
    if (!e.userId) continue;
    if (e.kind !== 'pr_verified' && e.kind !== 'concept_verified' && e.kind !== 'pr_walkthrough') continue;
    perUser.set(e.userId, (perUser.get(e.userId) ?? 0) + weightFor(e));
  }

  const ranked = [...perUser.entries()].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, w]) => s + w, 0);
  if (ranked.length < 2 || total <= 0) {
    return {
      value: null,
      components: [],
      sampleSize: ranked.length,
      evidenceCount: evidence.length,
      insufficientData: true,
      reason: 'Needs verified evidence from at least two engineers to measure concentration.',
    };
  }

  const topTwo = ranked.slice(0, 2).reduce((s, [, w]) => s + w, 0);
  const value = Math.round((topTwo / total) * 10000) / 100; // 0-100
  return {
    value,
    components: ranked.slice(0, 5).map(([userId, w]) => ({
      label: `User ${userId}`,
      contribution: Math.round((w / total) * 10000) / 100,
      weight: w,
    })),
    sampleSize: ranked.length,
    evidenceCount: evidence.length,
    insufficientData: false,
  };
}

/**
 * Understanding Gap — the roadmap's signature B2B metric.
 * = Code Change Velocity − Understanding Velocity, both normalized 0-100.
 * Positive gap = understanding is falling behind change; near-zero or
 * negative = healthy.
 */
export function computeUnderstandingGap(input: {
  codeChangeVelocity: number;
  understandingVelocity: number;
  windowDays?: number;
}): ScoreExplanation {
  const { codeChangeVelocity, understandingVelocity, windowDays = 30 } = input;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const change = clamp(codeChangeVelocity);
  const understanding = clamp(understandingVelocity);
  const value = Math.round((change - understanding) * 100) / 100;
  return {
    value,
    components: [
      { label: 'Code Change Velocity', contribution: change, weight: 1 },
      { label: 'Understanding Velocity', contribution: understanding, weight: 1 },
    ],
    sampleSize: windowDays,
    evidenceCount: 0,
    insufficientData: false,
    reason: 'Directional only: shows whether understanding is keeping pace with change.',
  };
}

/**
 * Bucketing helper: turn a raw concentration score into the roadmap's
 * three-band risk label. Kept out of the score so the UI is free to render
 * either the number or the label.
 */
export function concentrationRiskLabel(value: number | null): 'critical' | 'watch' | 'healthy' | null {
  if (value == null) return null;
  if (value >= 80) return 'critical';
  if (value >= 55) return 'watch';
  return 'healthy';
}
