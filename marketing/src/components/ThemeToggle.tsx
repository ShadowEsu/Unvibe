"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "./providers/ThemeProvider";
import { cn } from "@/lib/utils";

const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Segmented light / dark / system control. Falls back to a stable layout during SSR to
 * avoid a hydration mismatch (preference is only known on the client). A radio group: one Tab
 * stop (the checked option, or System before mount), and the arrow keys, Home and End move
 * focus and select.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const [mounted, setMounted] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Defer showing the active state until mounted to avoid a hydration mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  const checked = mounted ? preference : "system";

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const jump = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : null;
    if (step === undefined && jump === null) return;
    event.preventDefault();
    const next = jump ?? (index + step! + options.length) % options.length;
    setPreference(options[next]!.value);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill border border-line bg-surface p-0.5",
        className
      )}
    >
      {options.map(({ value, label, Icon }, index) => {
        const active = mounted && preference === value;
        return (
          <button
            key={value}
            ref={(node) => { buttons.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            tabIndex={checked === value ? 0 : -1}
            onClick={() => setPreference(value)}
            onKeyDown={(event) => onKey(event, index)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-pill transition-colors duration-micro",
              active
                ? "bg-primary-soft text-primary"
                : "text-fg-faint hover:text-fg"
            )}
          >
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
