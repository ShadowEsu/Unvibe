'use client';

/**
 * Percentage card with a horizontal bar and a "Why this score?" affordance,
 * per the Teams Intelligence Roadmap's visual system:
 *   - Horizontal bar with the exact number beside it.
 *   - Green/amber/red only for risk/status; every other card stays neutral
 *     Unvibe-purple.
 *   - Every score exposes its component values and evidence count.
 *   - Insufficient-evidence scores render "Not enough data yet" rather than
 *     manufacturing a percentage.
 */

import { useId, useState } from 'react';
import type { ScoreExplanation } from '@/teams/scores';

type Tone = 'neutral' | 'good' | 'watch' | 'critical';

export function ScoreCard({
  label,
  hint,
  score,
  trendDelta,
  tone = 'neutral',
  suffix = '%',
}: {
  label: string;
  hint?: string;
  score: ScoreExplanation;
  trendDelta?: number;
  tone?: Tone;
  suffix?: string;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const insufficient = score.insufficientData || score.value == null;
  const value = insufficient ? 0 : (score.value as number);
  const barPct = Math.max(0, Math.min(100, value));
  const trendLabel =
    trendDelta === undefined
      ? null
      : trendDelta > 0
        ? `▲ ${Math.abs(trendDelta).toFixed(1)}`
        : trendDelta < 0
          ? `▼ ${Math.abs(trendDelta).toFixed(1)}`
          : '· 0';

  return (
    <article className={`score-card score-card--${tone}${insufficient ? ' score-card--empty' : ''}`}>
      <header className="score-card__head">
        <div>
          <div className="score-card__label">{label}</div>
          {hint ? <div className="score-card__hint">{hint}</div> : null}
        </div>
        <button
          type="button"
          className="score-card__why"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
        >
          Why?
        </button>
      </header>

      {insufficient ? (
        <div className="score-card__empty-state">
          Not enough data yet.
          {score.reason ? <div className="score-card__reason">{score.reason}</div> : null}
        </div>
      ) : (
        <>
          <div
            className="score-card__number"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
            aria-label={`${label}: ${value}${suffix}`}
          >
            <strong>{value}</strong>
            <span>{suffix}</span>
            {trendLabel ? (
              <em className={`score-card__trend${trendDelta && trendDelta > 0 ? ' up' : ''}${trendDelta && trendDelta < 0 ? ' down' : ''}`}>
                {trendLabel} · 30d
              </em>
            ) : null}
          </div>
          <div className="score-card__track">
            <div className="score-card__fill" style={{ width: `${barPct}%` }} />
          </div>
        </>
      )}

      {open ? (
        <section id={detailsId} className="score-card__details">
          <p className="score-card__details-lead">
            Built from <b>{score.evidenceCount.toLocaleString()}</b> evidence rows
            {score.sampleSize > 0 ? <> across <b>{score.sampleSize.toLocaleString()}</b> samples</> : null}
            {score.freshnessAnchor ? <> · newest {new Date(score.freshnessAnchor).toLocaleDateString()}</> : null}
            .
          </p>
          {score.reason ? <p className="score-card__details-note">{score.reason}</p> : null}
          {score.components.length > 0 ? (
            <table className="score-card__components">
              <thead>
                <tr>
                  <th>Contribution</th>
                  <th>Value</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {score.components.map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}</td>
                    <td>{typeof c.contribution === 'number' ? c.contribution.toFixed(2) : c.contribution}</td>
                    <td>{c.weight.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
