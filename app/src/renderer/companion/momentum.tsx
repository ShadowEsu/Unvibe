import { useEffect, useState } from 'react';
import type { KnowledgeObject } from '../../core/knowledge';
import { linesLabel } from '../../core/linesLabel';
import { Buddy } from '../shared/buddy';
import { CountUp } from '../shared/countUp';
import { deviceName } from '../shared/platform';
import { InkTitle } from './inkTitle';

/** The parts of the profile Momentum reads (companion.tsx's `Profile` has these and more). */
interface MomentumProfile {
  reviews: number; needsReview: number;
  linesUnderstood: number; linesReviewed: number;
  usage: Array<{ label: string; pct: number }>; heat: number[];
}

/**
 * Momentum in Mono (OPTIONS.md "Organised containers", Momentum row): the title box; four number tiles; "Explained
 * per day" (26 weeks in five greys of the text colour) beside "Where you learn"; "Understanding over time", where
 * Vibe sleeps beside the app's sentence until there is a curve. The ask bar under it is the shell's.
 */
export function Progress({ profile }: { profile: MomentumProfile | null }) {
  const [knowledge, setKnowledge] = useState<KnowledgeObject[] | null>(null);
  useEffect(() => {
    void window.unvibe.listKnowledge().then((result) => {
      const next = result as { ok?: boolean; items?: KnowledgeObject[] };
      if (next?.ok) setKnowledge(next.items ?? []);
    });
  }, []);
  const heat = profile?.heat ?? Array.from({ length: 182 }, () => 0);
  const coverage = profile && profile.linesReviewed > 0
    ? Math.round((profile.linesUnderstood / profile.linesReviewed) * 100)
    : null;
  const currentKnowledge = knowledge ? knowledge.filter((item) => item.freshnessStatus === 'CURRENT').length : 0;
  // Like coverage: the share as the figure, the count under it (Design P3: the card repeated "5 of 6 current").
  const freshness = knowledge && knowledge.length
    ? { share: Math.round((currentKnowledge / knowledge.length) * 100), count: `${currentKnowledge} of ${knowledge.length} current` }
    : null;
  const tiles = [
    { num: coverage !== null ? <><CountUp value={coverage} />%</> : '–', label: 'Understanding coverage', note: coverage !== null ? `${profile?.linesUnderstood ?? 0} of ${linesLabel(profile?.linesReviewed ?? 0)}` : 'Not enough data yet.' },
    { num: freshness ? <><CountUp value={freshness.share} />%</> : '–', label: 'Knowledge freshness', note: freshness?.count ?? 'Not enough data yet.' },
    { num: profile ? <CountUp value={profile.reviews} /> : '–', label: 'Explanations saved', note: profile ? `${profile.needsReview} still to revisit` : 'Not enough data yet.' },
    { num: profile ? <CountUp value={profile.needsReview} /> : '–', label: 'Marked to revisit', note: profile && profile.needsReview > 0 ? 'Saved to check again' : 'Not enough data yet.' },
  ];
  const usage = profile && profile.usage.length > 0 ? profile.usage : [{ label: 'Editors & IDEs', pct: 0 }, { label: 'Terminal', pct: 0 }, { label: 'Browser & docs', pct: 0 }];
  return (
    <div className="mmom">
      <section className="m-box mmom-head">
        <h1 className="mono-title"><InkTitle text="Momentum" /></h1>
        <p className="mono-lead">What you have actually understood on this {deviceName}. No invented scores.</p>
      </section>
      <div className="m-grid m-grid--quarters">
        {tiles.map((tile) => (
          <article key={tile.label} className="m-box m-tile">
            <span className="m-tile__num">{tile.num}</span>
            <span className="m-tile__label">{tile.label}</span>
            <span className="m-tile__note">{tile.note}</span>
          </article>
        ))}
      </div>
      <div className="m-grid m-grid--23">
        <section className="m-box m-box--flush">
          <header className="m-box__title"><h2>Explained per day</h2><span className="m-box__meta">Last 6 months</span></header>
          <div className="m-box__body mmom-days">
            <div className="mmom-heat">{heat.map((lvl, i) => <i key={i} data-level={lvl || undefined} />)}</div>
            <div className="mmom-legend">
              <div className="mmom-legend__scale"><span>Less</span><i /><i data-level="1" /><i data-level="2" /><i data-level="3" /><i data-level="4" /><i data-level="5" /><span>More</span></div>
              <p>5, 25, 50, 100, 200 lines explained that day.</p>
            </div>
          </div>
        </section>
        <section className="m-box m-box--flush">
          <header className="m-box__title"><h2>Where you learn</h2></header>
          <div className="m-box__body">
            <div className="mmom-bars">
              {usage.map((u) => (
                <div className="mmom-bar" key={u.label}>
                  <div className="mmom-bar__label"><span>{u.label}</span><b>{u.pct}%</b></div>
                  <div className="mmom-bar__track"><i style={{ width: `${u.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <p className="mmom-note">Unvibe notes which app you were in when you asked, never what you typed.</p>
          </div>
        </section>
      </div>
      <section className="m-box m-box--flush">
        <header className="m-box__title"><h2>Understanding over time</h2></header>
        <div className="m-box__body mmom-curve">
          <Buddy mood="sleepy" size={44} />
          <p>Your weekly curve of lines understood will draw itself here after a few days of reviewing.</p>
        </div>
      </section>
    </div>
  );
}
