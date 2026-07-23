"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "unvibe_announcement_yc_f26_v2";

/** Classic Y Combinator mark — orange square, white Y. */
function YCombinatorMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="80" height="80" rx="10" fill="#F26522" />
      <path
        d="M40.2 46.5 54.8 22.2h-8.4L40.2 34.8 33.6 22.2h-8.4L40.2 46.5Zm-3.4 2.8h6.8V58h-6.8V49.3Z"
        fill="#fff"
      />
    </svg>
  );
}

/**
 * A deliberately quiet, site-wide YC application note. Dismissal persists so
 * returning visitors do not repeatedly see it.
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
    <div className="relative z-40 border-b border-[#F26522]/25 bg-[#171323] text-[#f2eef9]">
      <div className="container-page relative flex min-h-9 items-center justify-center gap-2 px-10 py-2 text-center">
        <YCombinatorMark className="h-5 w-5 shrink-0" />
        <p className="text-xs font-medium leading-none tracking-tight text-white/85 sm:text-sm">
          Applying for{" "}
          <span className="font-semibold text-[#F26522]">Y Combinator Fall 2026</span>
          <span className="hidden sm:inline"> — wish me luck 🍀</span>
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
          className="absolute right-3 flex h-6 w-6 items-center justify-center rounded text-white/45 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26522]"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
