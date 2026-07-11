/** Unvibe mark — rounded hexagon enclosing a U. Inherits color via currentColor. */
export function LogoMark({ size = 22, stroke = 1.9 }: { size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-label="Unvibe"
    >
      <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
      <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
    </svg>
  );
}
