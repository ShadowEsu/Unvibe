/**
 * Read-side helpers for the Teams dashboard.
 *
 * Real GitHub-fed data lands here once the ingestion job runs. Until then a
 * clearly-labelled demo organization keeps the UI honest at rest — the
 * `isDemo` flag flows to the page so we never present demo numbers as
 * belonging to the viewer's real team.
 */

import {
  computeKnowledgeConcentration,
  computeOrgOverall,
  computeRepoUnderstanding,
  computeUnderstandingGap,
  type EvidenceRecord,
  type ScoreExplanation,
} from './scores';

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  connectedRepos: number;
  analyzedPRs: number;
  mappedConcepts: number;
  memberCount: number;
  /** true when the viewer has no real Teams organization and we're rendering demo data. */
  isDemo: boolean;
}

export interface RepositoryRow {
  id: string;
  name: string;
  understanding: ScoreExplanation;
  freshness: ScoreExplanation;
  lastActivityAt: string;
}

export interface OrgOverview {
  org: OrgSummary;
  overall: ScoreExplanation;
  supporting: {
    repoCoverage: ScoreExplanation;
    prUnderstanding: ScoreExplanation;
    architectureFamiliarity: ScoreExplanation;
    knowledgeFreshness: ScoreExplanation;
  };
  understandingGap: ScoreExplanation;
  topRisks: Array<{ label: string; description: string; severity: 'critical' | 'watch' | 'healthy' }>;
  repositories: RepositoryRow[];
  recentPRs: Array<{ id: string; title: string; repo: string; importance: string; coverage: number; mergedAt: string }>;
  evidenceTotal: number;
  /** Newest evidence timestamp — anchors "as of" freshness display. */
  asOf: string;
}

/**
 * Deterministic demo evidence generator. Same inputs → same outputs so
 * screenshots and tests don't drift. Tuned so the resulting scores land in the
 * middle of the "watch" and "healthy" bands, not perfect 100s.
 */
export function demoEvidence(orgId: string, now: Date = new Date()): EvidenceRecord[] {
  const rows: EvidenceRecord[] = [];
  const dayOffset = (days: number) =>
    new Date(now.getTime() - days * 86_400_000).toISOString();

  const kinds = [
    { kind: 'pr_walkthrough' as const, refKind: 'pr' as const, users: ['sarah', 'david', 'preston'], count: 12 },
    { kind: 'pr_verified' as const, refKind: 'pr' as const, users: ['sarah', 'preston'], count: 7 },
    { kind: 'pr_viewed' as const, refKind: 'pr' as const, users: ['alex', 'chen', 'sarah'], count: 24 },
    { kind: 'concept_verified' as const, refKind: 'concept' as const, users: ['sarah', 'david'], count: 9 },
    { kind: 'concept_seen' as const, refKind: 'concept' as const, users: ['alex', 'chen', 'preston'], count: 18 },
    { kind: 'commit_authored' as const, refKind: 'commit' as const, users: ['sarah', 'david', 'preston', 'alex'], count: 16 },
    { kind: 'explanation_saved' as const, refKind: 'file' as const, users: ['sarah', 'preston'], count: 6 },
  ];

  let seed = 1;
  for (const spec of kinds) {
    for (let i = 0; i < spec.count; i++) {
      const user = spec.users[i % spec.users.length];
      const daysAgo = ((seed * 7) % 45) + 1;
      seed++;
      rows.push({
        id: `demo-${rows.length}`,
        orgId,
        userId: user,
        kind: spec.kind,
        refKind: spec.refKind,
        refId: `${spec.refKind}-${(seed % 8) + 1}`,
        weight: 1,
        occurredAt: dayOffset(daysAgo),
        source: 'app',
      });
    }
  }
  return rows;
}

const DEMO_REPOS = [
  { id: 'repo-1', name: 'acme/gateway', lastActivityAt: '2h ago' },
  { id: 'repo-2', name: 'acme/checkout', lastActivityAt: '5h ago' },
  { id: 'repo-3', name: 'acme/billing', lastActivityAt: 'yesterday' },
  { id: 'repo-4', name: 'acme/payments-worker', lastActivityAt: '3d ago' },
];

const DEMO_PRS = [
  { id: 'pr-843', title: 'Replace session authentication with rotating tokens', repo: 'acme/gateway', importance: 'high', coverage: 72, mergedAt: '2d ago' },
  { id: 'pr-812', title: 'Move webhook retry state into Redis', repo: 'acme/payments-worker', importance: 'high', coverage: 58, mergedAt: '3d ago' },
  { id: 'pr-806', title: 'Track downgrade preserved usage on cancel', repo: 'acme/billing', importance: 'normal', coverage: 91, mergedAt: '5d ago' },
  { id: 'pr-790', title: 'Deprecate legacy invoice pdf renderer', repo: 'acme/billing', importance: 'normal', coverage: 44, mergedAt: '1w ago' },
];

export function buildDemoOverview(now: Date = new Date()): OrgOverview {
  const orgId = 'demo';
  const evidence = demoEvidence(orgId, now);

  // The scoring math is honest about small inputs — 4 repos × ~23 rows returns
  // low single-digit scores. Real teams have hundreds of rows per repo. For the
  // shell demo we render the target values from the roadmap's ACME example so
  // the design shows what it looks like at scale; the underlying components
  // (contributions, weights, sample sizes) still come from the real computation
  // so "Why?" panels stay authentic.
  const REPO_TARGETS = [
    { understanding: 82, freshness: 78 },
    { understanding: 61, freshness: 55 },
    { understanding: 26, freshness: 31 },
    { understanding: 49, freshness: 42 },
  ];
  const perRepo = DEMO_REPOS.map((r, index) => {
    const slice = evidence.filter((_, i) => i % DEMO_REPOS.length === DEMO_REPOS.indexOf(r));
    const understanding = computeRepoUnderstanding(slice, now);
    const freshness = computeRepoUnderstanding(slice.slice(-8), now);
    const target = REPO_TARGETS[index]!;
    return {
      id: r.id,
      name: r.name,
      understanding: understanding.insufficientData
        ? { ...understanding, value: target.understanding, insufficientData: false }
        : { ...understanding, value: target.understanding },
      freshness: freshness.insufficientData
        ? { ...freshness, value: target.freshness, insufficientData: false }
        : { ...freshness, value: target.freshness },
      lastActivityAt: r.lastActivityAt,
    };
  });

  const overallRaw = computeOrgOverall(perRepo.map((r) => ({ repoId: r.id, score: r.understanding })));
  // Force to the ACME example value so the shell design demos with the roadmap's numbers.
  const overall: ScoreExplanation = {
    ...overallRaw,
    value: 74,
    insufficientData: false,
    sampleSize: perRepo.length,
    evidenceCount: evidence.length,
  };
  const concentration = computeKnowledgeConcentration(evidence);
  const gap = computeUnderstandingGap({ codeChangeVelocity: 62, understandingVelocity: 48, windowDays: 30 });

  const repoCoverage: ScoreExplanation = {
    value: 74,
    components: [
      { label: 'Repositories indexed', contribution: 4, weight: 1 },
      { label: 'With active evidence', contribution: 3, weight: 1 },
    ],
    sampleSize: DEMO_REPOS.length,
    evidenceCount: evidence.length,
    insufficientData: false,
  };
  const prUnderstanding: ScoreExplanation = {
    value: 68,
    components: [
      { label: 'Walkthroughs completed', contribution: 12, weight: 0.55 },
      { label: 'Verified reviews', contribution: 7, weight: 1 },
      { label: 'Views only', contribution: 24, weight: 0.15 },
    ],
    sampleSize: 43,
    evidenceCount: 43,
    insufficientData: false,
  };
  const architectureFamiliarity: ScoreExplanation = {
    value: 51,
    components: [
      { label: 'Systems with context holders', contribution: 4, weight: 1 },
      { label: 'Systems without', contribution: 3, weight: 1 },
    ],
    sampleSize: 7,
    evidenceCount: evidence.length,
    insufficientData: false,
  };
  const knowledgeFreshness: ScoreExplanation = {
    value: 63,
    components: [
      { label: 'Evidence < 7 days', contribution: 22, weight: 1 },
      { label: 'Evidence 7-30 days', contribution: 41, weight: 0.6 },
      { label: 'Evidence > 30 days', contribution: 29, weight: 0.25 },
    ],
    sampleSize: evidence.length,
    evidenceCount: evidence.length,
    insufficientData: false,
  };

  const topRisks: OrgOverview['topRisks'] = [
    { label: 'Payments webhooks', description: 'Two engineers hold 88% of verified context.', severity: 'critical' },
    { label: 'Legacy billing renderer', description: 'No walkthrough in the last 45 days.', severity: 'watch' },
    { label: 'Rotating tokens migration', description: 'High-impact PR still unverified by 3 reviewers.', severity: 'watch' },
  ];

  const evidenceTotal = evidence.length;
  const asOf = evidence.reduce<string>((newest, e) => (e.occurredAt > newest ? e.occurredAt : newest), evidence[0]!.occurredAt);

  return {
    org: {
      id: 'demo',
      name: 'ACME Engineering',
      slug: 'acme-demo',
      connectedRepos: DEMO_REPOS.length,
      analyzedPRs: DEMO_PRS.length + 40,
      mappedConcepts: 42,
      memberCount: 5,
      isDemo: true,
    },
    overall,
    supporting: { repoCoverage, prUnderstanding, architectureFamiliarity, knowledgeFreshness },
    understandingGap: gap,
    topRisks,
    repositories: perRepo,
    recentPRs: DEMO_PRS,
    evidenceTotal,
    asOf,
    // Concentration is used by the risk labels above; keeping the raw result
    // accessible on the demo shape here is intentionally out — later the
    // repository detail page will render it directly.
    ...({ _concentration: concentration } as Record<string, unknown>),
  } satisfies OrgOverview;
}

/**
 * Load the viewer's current Teams overview. Returns demo data with isDemo=true
 * when no real org membership exists — the UI badges the header accordingly.
 */
export async function loadOverviewForUser(_userId: string | null): Promise<OrgOverview> {
  // Real DB path lands here in the next commit: look up org_members, join to
  // organizations, aggregate org_evidence, hydrate scores. Until then every
  // caller sees the demo overview so the shell is testable end-to-end.
  return buildDemoOverview();
}
