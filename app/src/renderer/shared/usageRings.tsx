import { useId } from 'react';
import { formatCount } from '../../core/plans';
import './usageRings.css';
import { LogoMark } from './logo';
import { isMac } from './platform';

/** `limit`/`remaining` null: an unlimited allowance (no monthly cap), drawn as "Unlimited" with no fraction. */
export type UsageSlice = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

function tone(pct: number): 'ok' | 'low' | 'out' {
  if (pct <= 0) return 'out';
  if (pct <= 20) return 'low';
  return 'ok';
}

function Ring({
  label,
  remaining,
  used,
  limit,
  size,
  tiny,
}: UsageSlice & { label: string; size: number; tiny: boolean }) {
  const unlimited = limit === null || remaining === null;
  const safeLimit = Math.max(1, limit ?? 1);
  const left = Math.max(0, remaining ?? 0);
  const pct = unlimited ? 100 : Math.min(100, Math.round((left / safeLimit) * 100));
  const radius = 15;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const detailId = useId();
  return (
    <span
      className={`usage-ring${tiny ? ' usage-ring--tiny' : ''}`}
      data-tone={tone(pct)}
      tabIndex={0}
      aria-label={unlimited
        ? `${label}: unlimited, ${formatCount(used)} used`
        : `${label}: ${formatCount(left)} of ${formatCount(safeLimit)} remaining, ${formatCount(used)} used`}
      aria-describedby={detailId}
    >
      <span className="usage-ring__dial" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle className="usage-ring__track" cx="18" cy="18" r={radius} fill="none" strokeWidth="3" />
          <circle
            className="usage-ring__value"
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className="usage-ring__brand"><LogoMark size={tiny ? 13 : 21} /></span>
        <b>{unlimited ? '∞' : `${pct}%`}</b>
      </span>
      <small>{label} · {unlimited ? 'Unlimited' : `${formatCount(left)} left`}</small>
      <span className="usage-ring__detail" role="tooltip" id={detailId}>
        <strong>{label === 'AI' ? '✨ AI explanations' : `${isMac ? '⌘' : '⌨'} Code selections`}</strong>
        <span>{formatCount(Math.max(0, used))} used · {unlimited ? 'Unlimited' : `${formatCount(left)} remaining`}</span>
        <span className="usage-ring__bar"><i style={{ width: `${pct}%` }} /></span>
        <span>{unlimited ? 'Unlimited, with no monthly limit' : `${pct}% of your ${formatCount(safeLimit)} allowance left`}</span>
      </span>
    </span>
  );
}

export function UsageRings({
  ai,
  selections,
  size = 44,
  tiny = false,
  onOpen,
}: {
  ai: UsageSlice;
  selections?: UsageSlice;
  size?: number;
  tiny?: boolean;
  onOpen?: () => void;
}) {
  const className = `usage-rings${tiny ? ' usage-rings--tiny' : ''}`;
  const dialSize = tiny ? Math.min(size, 26) : size;
  const body = (
    <>
      <Ring label="AI" size={dialSize} tiny={tiny} {...ai} />
      {selections ? <Ring label="Select" size={dialSize} tiny={tiny} {...selections} /> : null}
    </>
  );
  return <div className="usage-cluster">
    <div className={className} aria-label="Usage remaining">{body}</div>
    {onOpen && <button type="button" className="usage-plan" onClick={onOpen}>View allowance ↗</button>}
  </div>;
}
