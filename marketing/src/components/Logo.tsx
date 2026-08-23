import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  label?: string;
}

export function Logo({
  className,
  showWordmark = true,
  label = "Unvibe home",
}: LogoProps) {
  return (
    <span
      className={cn("paper-logo inline-flex items-center gap-2.5", className)}
      role="img"
      aria-label={label}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="paper-logo__mark shrink-0"
      >
        <g className="paper-logo__shadow paper-logo__shadow--far" transform="translate(0.7 0.7)">
          <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
          <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
        </g>
        <g className="paper-logo__shadow paper-logo__shadow--near" transform="translate(1 1)">
          <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
          <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
        </g>
        <g className="paper-logo__face">
          <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
          <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
        </g>
      </svg>
      {showWordmark && (
        <span className="paper-logo__word">Unvibe</span>
      )}
    </span>
  );
}
