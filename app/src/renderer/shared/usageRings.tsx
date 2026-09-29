import './usageRings.css';
import { LogoMark } from './logo';

export type UsageSlice = {
  used: number;
  limit: number;
  remaining: number;
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
  const safeLimit = Math.max(1, limit);
  const left = Math.max(0, remaining);
  const pct = Math.min(100, Math.round((left / safeLimit) * 100));
  const radius = 15;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  return (
    <span
      className={`usage-ring${tiny ? ' usage-ring--tiny' : ''}`}
      data-tone={tone(pct)}
      tabIndex={0}
      aria-label={`${label}: ${left} of ${safeLimit} remaining, ${used} used`}

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
        <b>{pct}%</b>
      </span>
      <small>{label} · {left} left</small>
      <span className="usage-ring__detail" role="tooltip">
        <strong>{label === 'AI' ? '✨ AI explanations' : '⌘ Code selections'}</strong>
        <span>{Math.max(0, used)} used · {left} remaining</span>
        <span className="usage-ring__bar"><i style={{ width: `${pct}%` }} /></span>
        <span>{pct}% of your {safeLimit} allowance left</span>
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
