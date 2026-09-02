import Link from 'next/link';
import { currentUserId } from '@/lib/session';
import { loadOverviewForUser } from '@/teams/read';
import { ScoreCard } from './ScoreCard';
import { TeamsEmpty } from './EmptyState';
import { concentrationRiskLabel } from '@/teams/scores';
import './teams.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unvibe Teams · Organization overview' };

/**
 * `/teams` — Phase 1 shell.
 *
 * Renders the Organization Overview from the Teams Roadmap:
 *   - Overall team understanding.
 *   - Four supporting percentage bars (repo coverage, PR understanding,
 *     architecture familiarity, freshness).
 *   - A trend delta beside each metric.
 *   - Recent significant PRs and top risks.
 *   - Evidence footer: repos indexed, PRs analyzed, concepts, members.
 *
 * When the viewer isn't a member of any real org yet, the empty state is
 * shown with a connect-GitHub CTA. Until the GitHub App env vars are wired,
 * a `?demo=1` query param opens the demo view without needing membership.
 */
export default async function TeamsPage({
  searchParams,
}: {
  searchParams?: { demo?: string };
}) {
  const userId = await currentUserId();
  const installUrl = process.env.GITHUB_APP_INSTALL_URL ?? null;
  const wantsDemo = searchParams?.demo === '1';

  // Real membership lookup lands in the next commit. Until then, only the
  // ?demo=1 override renders the populated overview so a signed-in-but-org-less
  // user isn't misled into thinking they've connected a real org.
  if (!wantsDemo) {
    return (
      <div className="teams-shell">
        <TeamsEmpty installUrl={installUrl} />
        <div className="teams-preview-link">
          <span>Want to see what it looks like?</span>
          <Link href="/teams?demo=1">Open demo overview →</Link>
        </div>
      </div>
    );
  }

  const overview = await loadOverviewForUser(userId);
  const gapValue = overview.understandingGap.value ?? 0;
  const gapTone = gapValue > 30 ? 'critical' : gapValue > 10 ? 'watch' : 'good';

  return (
    <div className="teams-shell">
      <header className="teams-hero">
        <div className="teams-hero__title">
          <span className="teams-hero__eyebrow">
            Organization overview
            {overview.org.isDemo ? <em className="teams-badge">Demo data</em> : null}
          </span>
          <h1>{overview.org.name}</h1>
          <p className="teams-hero__meta">
            <b>{overview.org.connectedRepos}</b> repositories connected · <b>{overview.org.analyzedPRs}</b> PRs analyzed
            · <b>{overview.org.mappedConcepts}</b> concepts mapped · <b>{overview.org.memberCount}</b> members
          </p>
        </div>
        <div className="teams-hero__asOf">
          As of {new Date(overview.asOf).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      </header>

      <section className="teams-summary">
        <ScoreCard
          label="Overall team understanding"
          hint="Weighted across every connected repository."
          score={overview.overall}
          trendDelta={+4.2}
          tone="neutral"
        />
        <ScoreCard
          label="Understanding gap"
          hint="Code change velocity − understanding velocity, last 30 days."
          score={overview.understandingGap}
          tone={gapTone}
          suffix=""
        />
      </section>

      <section className="teams-metrics">
        <ScoreCard label="Repository coverage" score={overview.supporting.repoCoverage} trendDelta={+1.5} />
        <ScoreCard label="PR understanding" score={overview.supporting.prUnderstanding} trendDelta={-2.1} />
        <ScoreCard label="Architecture familiarity" score={overview.supporting.architectureFamiliarity} trendDelta={+0.4} />
        <ScoreCard label="Knowledge freshness" score={overview.supporting.knowledgeFreshness} trendDelta={-3.6} />
      </section>

      <section className="teams-two">
        <article className="teams-panel">
          <header>
            <h2>Top knowledge risks</h2>
            <span>Ordered by severity.</span>
          </header>
          <ul className="teams-risks">
            {overview.topRisks.map((r) => (
              <li key={r.label} className={`teams-risk teams-risk--${r.severity}`}>
                <span className="teams-risk__dot" />
                <div>
                  <b>{r.label}</b>
                  <p>{r.description}</p>
                </div>
                <span className="teams-risk__label">
                  {r.severity === 'critical' ? 'Critical' : r.severity === 'watch' ? 'Watch' : 'Healthy'}
                </span>
              </li>
            ))}
            {overview.topRisks.length === 0 ? (
              <li className="teams-risks__empty">No active knowledge risks. Nice.</li>
            ) : null}
          </ul>
        </article>

        <article className="teams-panel">
          <header>
            <h2>Recent significant PRs</h2>
            <span>Automatically flagged from importance and file impact.</span>
          </header>
          <ul className="teams-prs">
            {overview.recentPRs.map((pr) => (
              <li key={pr.id} className="teams-pr">
                <div>
                  <b>{pr.title}</b>
                  <p><code>{pr.repo}</code> · {pr.mergedAt} · <span className={`teams-pr__importance teams-pr__importance--${pr.importance}`}>{pr.importance}</span></p>
                </div>
                <div className="teams-pr__coverage" aria-label={`Team coverage ${pr.coverage} percent`}>
                  <span className="teams-pr__coverage-track"><i style={{ width: `${pr.coverage}%` }} /></span>
                  <b>{pr.coverage}%</b>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="teams-repos">
        <header>
          <h2>Repositories</h2>
          <span>{overview.repositories.length} connected · sorted by activity.</span>
        </header>
        <table className="teams-repo-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Understanding</th>
              <th>Freshness</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {overview.repositories.map((repo) => (
              <tr key={repo.id}>
                <td><b>{repo.name}</b></td>
                <td>
                  <MiniBar score={repo.understanding} />
                </td>
                <td>
                  <MiniBar score={repo.freshness} />
                </td>
                <td className="teams-repo-table__meta">{repo.lastActivityAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="teams-foot">
        Concentration risk: <b>{describeConcentration(overview)}</b>.
        Every score derives from {overview.evidenceTotal.toLocaleString()} evidence rows —
        <Link href="/teams?demo=1"> open a card and press <em>Why?</em></Link> to see the breakdown.
      </footer>
    </div>
  );
}

function MiniBar({ score }: { score: import('@/teams/scores').ScoreExplanation }) {
  if (score.insufficientData || score.value == null) {
    return <span className="teams-mini teams-mini--empty">Not enough data</span>;
  }
  const pct = Math.max(0, Math.min(100, score.value));
  return (
    <span className="teams-mini">
      <span className="teams-mini__track"><i style={{ width: `${pct}%` }} /></span>
      <b>{Math.round(pct)}%</b>
    </span>
  );
}

function describeConcentration(overview: import('@/teams/read').OrgOverview): string {
  const raw = (overview as unknown as { _concentration?: import('@/teams/scores').ScoreExplanation })._concentration;
  if (!raw || raw.insufficientData || raw.value == null) return 'not measurable yet';
  const band = concentrationRiskLabel(raw.value);
  return `${Math.round(raw.value)}% held by top two engineers (${band ?? 'n/a'})`;
}
