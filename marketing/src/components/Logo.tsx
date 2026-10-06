import { cn } from "@/lib/utils";
import { Vibe } from "@/components/paper/Vibe";

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
      <Vibe size={30} follow={false} className="paper-logo__vibe" />
      {showWordmark && (
        <span className="paper-logo__word">Unvibe</span>
      )}
    </span>
  );
}
