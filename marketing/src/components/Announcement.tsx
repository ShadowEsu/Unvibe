"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "unvibe_announcement_dismissed";
const MESSAGE = "Vibe code without the guilt — free private beta, no API key required.";

/**
 * Slim announcement bar. Dismissible, and the dismissal persists in localStorage so it
 * does not nag on return visits. Hidden entirely until we confirm it was not dismissed,
 * which avoids a flash of the bar for returning visitors.
 */
export function Announcement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="relative z-40 border-b border-line bg-primary-soft text-primary-strong">
      <div className="container-page flex items-center justify-center gap-3 py-2 text-center text-fluid-sm">
        <p className="font-medium">
          {MESSAGE}{" "}
          <a
            href="#waitlist"
            className="underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            Join the waitlist
          </a>
        </p>
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => {
            setVisible(false);
            try {
              window.localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              // Ignore storage failures.
            }
          }}
          className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full text-primary-strong/70 transition-colors hover:bg-primary/10 hover:text-primary-strong"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
