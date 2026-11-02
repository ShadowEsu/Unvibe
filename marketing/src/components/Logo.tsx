// clsx, not cn(): the Nav ships this to the browser on every page, and tailwind-merge (27 KB) has no conflict to resolve here.
import { clsx } from "clsx";
import { Vibe } from "@/components/paper/Vibe";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  label?: string;
  /** The mascot's height in CSS px. */
  size?: number;
}

export function Logo({
  className,
  showWordmark = true,
  label = "Unvibe home",
  size = 30,
}: LogoProps) {
  return (
    <span
      className={clsx("paper-logo inline-flex items-center gap-2.5", className)}
      role="img"
      aria-label={label}
    >
      <Vibe size={size} follow={false} className="paper-logo__vibe" />
      {showWordmark && (
        <span className="paper-logo__word">Unvibe</span>
      )}
    </span>
  );
}
