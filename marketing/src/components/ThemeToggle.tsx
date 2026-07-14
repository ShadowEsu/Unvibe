"use client";

import { useEffect, useState } from "react";
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
 * avoid a hydration mismatch (preference is only known on the client).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Defer showing the active state until mounted to avoid a hydration mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-pill border border-line bg-surface p-0.5",
        className
      )}
    >
      {options.map(({ value, label, Icon }) => {
        const active = mounted && preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
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
