"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "unvibe_announcement_yc_f26_v1";

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
 * Top-of-site banner: YC application + forever-free waitlist promise.
 * Dismissible; dismissal persists so it does not nag on return visits.
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
    <div className="relative z-40 overflow-hidden border-b border-black/10 bg-[#0b0911] text-[#f2eef9]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 40%, #F26522 0%, transparent 42%), radial-gradient(circle at 88% 60%, #6f45d2 0%, transparent 40%)",
        }}
      />
      <div className="container-page relative flex flex-col items-center gap-3 px-4 py-5 text-center sm:py-6 md:py-7">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <YCombinatorMark className="h-12 w-12 shrink-0 shadow-[4px_4px_0_rgba(242,101,34,0.35)] sm:h-14 sm:w-14 md:h-16 md:w-16" />
          <p className="max-w-3xl text-balance text-[1.35rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-[1.75rem] md:text-[2.15rem]">
            Applying for <span className="text-[#F26522]">Y Combinator</span> Fall 2026 — wish me luck 🍀
          </p>
        </div>
        <p className="max-w-2xl text-pretty text-[0.95rem] font-medium leading-snug text-white/80 sm:text-[1.05rem] md:text-[1.15rem]">
          Forever free.{" "}
          <a
            href="#waitlist"
            className="text-white underline decoration-[#F26522]/70 underline-offset-4 transition hover:decoration-[#F26522]"
          >
            Join the waitlist
          </a>{" "}
          and you get the app from me.
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
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
