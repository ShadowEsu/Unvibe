import './usageRings.css';

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
      title={`${label}: ${left} of ${safeLimit} left`}
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
        <b>{left}</b>
      </span>
      <small>{label}</small>
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
  if (onOpen) {
    return (
      <button type="button" className={className} onClick={onOpen} aria-label="Open usage">
        {body}
      </button>
    );
  }
  return <div className={className} aria-label="Usage remaining">{body}</div>;
}
