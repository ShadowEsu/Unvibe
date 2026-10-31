import { useEffect, useState } from 'react';
import type { KnowledgeObject } from '../../core/knowledge';
import { deviceName } from '../shared/platform';
import { LearningEmpty } from './learn';
import { PAGE_NAMES } from './names';

/** What Momentum reads from the learning profile (`learning:profile`). */
export interface MomentumProfile {
  reviews: number; needsReview: number;
  linesUnderstood: number; linesReviewed: number;
  usage: Array<{ label: string; pct: number }>; heat: number[];
}

/**
 * Momentum: what has been understood on this computer, with no invented scores. Before the first
 * saved explanation there is nothing to measure, so the page names its one next step with the
 * Library's empty pattern instead of four "–" tiles (Design A8, polish bar B-4). Once there is data,
 * a tile shows only when it has a value.
 */
export function Momentum({ profile, onExplain }: { profile: MomentumProfile | null; onExplain: () => void }) {
  const [knowledge, setKnowledge] = useState<KnowledgeObject[] | null>(null);
  useEffect(() => {
    void window.unvibe.listKnowledge().then((result) => {
      const next = result as { ok?: boolean; items?: KnowledgeObject[] };
      if (next?.ok) setKnowledge(next.items ?? []);
    });
  }, []);
  const head = (
    <>
      <div className="topline"><h1>{PAGE_NAMES.Progress}</h1></div>
      <p className="lead">What you have actually understood on this {deviceName}. No invented scores.</p>
    </>
  );
  if (!profile || profile.reviews === 0) {
    return (
      <>
        {head}
        <LearningEmpty
          title="Nothing to measure yet."
          detail="Momentum counts what you explain and understand. It starts with your first explanation."
          onReview={onExplain}
        />
      </>
    );
  }
  const currentKnowledge = knowledge ? knowledge.filter((item) => item.freshnessStatus === 'CURRENT').length : 0;
  const tiles = [
    // Like coverage: the share as the figure, the count under it (Design P3: the card repeated "5 of 6 current").
    profile.linesReviewed > 0
      ? { label: 'Understanding coverage', value: `${Math.round((profile.linesUnderstood / profile.linesReviewed) * 100)}%`, note: `${profile.linesUnderstood} of ${profile.linesReviewed} lines` }
      : null,
    knowledge && knowledge.length
      ? { label: 'Knowledge freshness', value: `${Math.round((currentKnowledge / knowledge.length) * 100)}%`, note: `${currentKnowledge} of ${knowledge.length} current` }
      : null,
    { label: 'Explanations saved', value: String(profile.reviews), note: `${profile.needsReview} still to revisit` },
    { label: 'Marked to revisit', value: String(profile.needsReview), note: profile.needsReview > 0 ? 'Saved to check again' : 'None marked yet.' },
  ].filter((tile) => tile !== null);
  return (
    <>
      {head}
      <div className="metrics">
        {tiles.map((tile) => (
          <article key={tile.label} className="metric-card"><span className="v">{tile.value}</span><span className="l">{tile.label}</span><span className="note">{tile.note}</span></article>
        ))}
      </div>
      <div className="panel-card">
        <div className="ph"><span className="t">Explained per day</span><span className="m">last 6 months</span></div>
        <div className="heat">{profile.heat.map((lvl, i) => <i key={i} className={lvl ? `a${lvl}` : ''} />)}</div>
        <div className="heat-legend"><span>Less</span><i /><i className="a1" /><i className="a2" /><i className="a3" /><i className="a4" /><i className="a5" /><span>More</span><span className="heat-legend__note">5, 25, 50, 100, 200 lines explained that day.</span></div>
      </div>
      <div className="two">
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="ph"><span className="t">Where you learn</span></div>
          <div className="bars">
            {(profile.usage.length > 0 ? profile.usage : [{ label: 'Editors & IDEs', pct: 0 }, { label: 'Terminal', pct: 0 }, { label: 'Browser & docs', pct: 0 }]).map((u) => (
              <div className="bar-row" key={u.label}><div className="bl"><span>{u.label}</span><span>{u.pct}%</span></div><div className="bar-track"><i style={{ width: `${u.pct}%` }} /></div></div>
            ))}
          </div>
          <p className="soft-note">Unvibe notes which app you were in when you asked, never what you typed.</p>
        </div>
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="ph"><span className="t">Understanding over time</span></div>
          <div className="chart-empty">Your weekly curve of lines understood will draw itself here after a few days of reviewing.</div>
        </div>
      </div>
    </>
  );
}
