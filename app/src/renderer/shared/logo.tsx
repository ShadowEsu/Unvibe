/** Unvibe mark — purple hexagon U with baked 45° shadow, or white for on-fill badges. */
export function LogoMark({
  size = 22,
  stroke = 1.9,
  tone = 'brand',
}: {
  size?: number;
  stroke?: number;
  tone?: 'brand' | 'onFill';
}) {
  const shadowStroke = Math.max(1.2, stroke * 0.95);
  const main = tone === 'onFill' ? '#ffffff' : '#6f45d2';
  const shadowA = tone === 'onFill' ? 'rgba(255,255,255,0.28)' : 'rgba(61,32,128,0.22)';
  const shadowB = tone === 'onFill' ? 'rgba(255,255,255,0.14)' : 'rgba(61,32,128,0.12)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-label="Unvibe"
    >
      <g stroke={shadowA} strokeWidth={shadowStroke} transform="translate(0.7 0.7)">
        <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
        <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
      </g>
      <g stroke={shadowB} strokeWidth={shadowStroke * 1.25} transform="translate(1 1)">
        <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
        <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
      </g>
      <g stroke={main} strokeWidth={stroke}>
        <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
        <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
      </g>
    </svg>
  );
}
