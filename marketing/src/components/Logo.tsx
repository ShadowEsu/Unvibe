import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  /** Accessible label for the mark when used as a link. */
  label?: string;
}

/**
 * Hexagon U mark plus wordmark. The mark uses currentColor so it inherits text color
 * and works in both themes. Original geometry — a hexagon containing a stylized U.
 */
export function Logo({
  className,
  showWordmark = true,
  label = "Unvibe home",
}: LogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label={label}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="shrink-0 text-primary"
      >
        <path
          d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span className="text-[1.1rem] font-semibold tracking-tight text-fg">
          Unvibe
        </span>
      )}
    </span>
  );
}
