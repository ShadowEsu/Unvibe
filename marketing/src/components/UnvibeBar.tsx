import { Home, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type UnvibeBarProps = {
  className?: string;
  tone?: "light" | "dark";
  busy?: boolean;
  hint?: string;
};

/**
 * Compact floating Unvibe bar — segmented pill like the desktop overlay.
 * Logo · shortcut · home. Small, clean, no serif wordmark.
 */
export function UnvibeBar({
  className,
  tone = "light",
  busy = false,
  hint = "to explain",
}: UnvibeBarProps) {
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-full border backdrop-blur-xl",
        dark
          ? "border-white/20 bg-white/[0.12] text-white shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
          : "border-black/[0.07] bg-white text-fg shadow-[0_6px_24px_rgba(15,20,28,0.10)]",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 pl-2.5 pr-2.5">
        <Mark dark={dark} />
        <span className="text-[13px] font-semibold tracking-tight">Unvibe</span>
        {busy && (
          <Loader2
            size={12}
            className={cn("animate-spin", dark ? "text-[#93c5fd]" : "text-primary")}
          />
        )}
      </div>

      <Divider dark={dark} />

      <div
        className={cn(
          "px-3 text-[12px] tracking-tight",
          dark ? "text-white/65" : "text-fg-muted"
        )}
      >
        <span className={cn("font-medium", dark ? "text-white/90" : "text-fg")}>
          ⌘U
        </span>{" "}
        {hint}
      </div>

      <Divider dark={dark} />

      <div className="flex items-center pr-1.5 pl-1">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            dark ? "text-white/80" : "text-fg-muted"
          )}
        >
          <Home size={14} strokeWidth={1.7} />
        </span>
      </div>
    </div>
  );
}

function Divider({ dark }: { dark: boolean }) {
  return (
    <span
      className={cn("h-3.5 w-px shrink-0", dark ? "bg-white/20" : "bg-black/[0.08]")}
    />
  );
}

function Mark({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" aria-hidden="true">
        <path
          d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-primary text-white">
      <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" fill="none" aria-hidden="true">
        <path
          d="M12 2.6 19.8 7.1 V16.9 L12 21.4 4.2 16.9 V7.1 Z"
          fill="currentColor"
        />
        <path
          d="M9 9 V12.2 A3 3 0 0 0 15 12.2 V9"
          stroke="#4F46E5"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
