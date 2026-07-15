"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LogoItem {
  name: string;
  mark: ReactNode;
  tone?: string;
}

const logos: LogoItem[] = [
  {
    name: "TypeScript",
    tone: "text-[#3178C6]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect width="24" height="24" rx="4" fill="currentColor" />
        <text x="5" y="16" fill="white" fontSize="9" fontWeight="700" fontFamily="system-ui">
          TS
        </text>
      </svg>
    ),
  },
  {
    name: "JavaScript",
    tone: "text-[#F7DF1E]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect width="24" height="24" rx="4" fill="currentColor" />
        <text x="6" y="16" fill="#111" fontSize="9" fontWeight="700" fontFamily="system-ui">
          JS
        </text>
      </svg>
    ),
  },
  {
    name: "Python",
    tone: "text-[#3776AB]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2c-3.2 0-3.6.1-4.6.4A3.4 3.4 0 0 0 5.4 4.4C5.1 5.4 5 6.5 5 9v1h7v1H4.4c-1.8 0-3.2 1.1-3.4 2.9-.2 1.3-.2 2.1 0 3.4.3 1.7 1.7 2.9 3.5 2.9H6v-2.6c0-2 1.7-3.7 3.8-3.7h4.4c1.7 0 3.2-1.4 3.2-3.2V9c0-3-.1-3.6-.4-4.6A3.4 3.4 0 0 0 14.6 2.4C13.6 2.1 13.2 2 12 2zm-2.2 2.4a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"
        />
        <path
          fill="#FFD43B"
          d="M12 22c3.2 0 3.6-.1 4.6-.4a3.4 3.4 0 0 0 2-2c.3-1 .4-2.1.4-4.6v-1h-7v-1h7.6c1.8 0 3.2-1.1 3.4-2.9.2-1.3.2-2.1 0-3.4-.3-1.7-1.7-2.9-3.5-2.9H18v2.6c0 2-1.7 3.7-3.8 3.7H9.8C8.1 11 6.6 12.4 6.6 14.2V15c0 3 .1 3.6.4 4.6a3.4 3.4 0 0 0 2 2c1 .3 1.4.4 3 .4zm2.2-2.4a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2z"
        />
      </svg>
    ),
  },
  {
    name: "React",
    tone: "text-[#61DAFB]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="1.4" />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4"
          stroke="currentColor"
          strokeWidth="1.4"
          transform="rotate(60 12 12)"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4"
          stroke="currentColor"
          strokeWidth="1.4"
          transform="rotate(120 12 12)"
        />
      </svg>
    ),
  },
  {
    name: "Go",
    tone: "text-[#00ADD8]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <text x="1" y="16" fill="currentColor" fontSize="11" fontWeight="700" fontFamily="system-ui">
          Go
        </text>
      </svg>
    ),
  },
  {
    name: "Rust",
    tone: "text-[#DEA584]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "SQL",
    tone: "text-[#336791]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M5 6v8c0 1.7 3.1 3 7 3s7-1.3 7-3V6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    ),
  },
  {
    name: "Cursor",
    tone: "text-fg",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="currentColor" d="M4 3l16 8.5-7.2 2.1L10.2 21 4 3z" />
      </svg>
    ),
  },
  {
    name: "VS Code",
    tone: "text-[#007ACC]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="currentColor"
          d="M17.5 2.5 9 9.3 4.8 6.2 3 7.2v9.6l1.8 1 4.2-3.1 8.5 6.8L21 20V4l-3.5-1.5zM5 14.8V9.2l3 2.3-3 3.3zm12.5 3.6L11 13.5l6.5-4.9v9.8z"
        />
      </svg>
    ),
  },
  {
    name: "GitHub",
    tone: "text-fg",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.2 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.2 2.7-1 2.7-1a3.6 3.6 0 0 1 .1 2.7 3.9 3.9 0 0 1 1 2.7c0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.8v2.6c0 .3.2.6.7.5A10 10 0 0 0 12 2z"
        />
      </svg>
    ),
  },
  {
    name: "Terminal",
    tone: "text-green",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 9l3 3-3 3M12 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Swift",
    tone: "text-[#F05138]",
    mark: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="currentColor"
          d="M20 16.5c-2.2 2.7-5.7 4.2-9.3 3.5 3.1-.5 5.7-2.3 7.2-4.8-3.4 2-7.5 2.1-10.8.2C4.3 13.7 2.8 10.4 3 7c1.4 1.8 3.3 3.2 5.4 4C6.5 8.7 5.7 5.8 6.3 3c2.3 2.4 5.1 4.1 8.2 5-1.8-2.3-2.5-5.3-1.8-8.1C16.4 3.2 19 7.4 19.2 12c1.1-1.1 1.8-2.5 2-4.1.7 2.8.1 5.8-1.2 8.6z"
        />
      </svg>
    ),
  },
];

export function BrandLogos({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mask-fade-x overflow-hidden border-y border-line bg-surface-2/40 py-5",
        className
      )}
      aria-label="Languages and tools Unvibe is designed to work beside. No partnership implied."
    >
      <p className="container-page mb-4 text-center text-[0.7rem] font-medium uppercase tracking-[0.18em] text-fg-faint">
        Designed to work beside the tools and languages you already use
      </p>
      <div className="flex w-max animate-marquee gap-10 pr-10 hover:[animation-play-state:paused]">
        {[...logos, ...logos].map((logo, i) => (
          <div
            key={`${logo.name}-${i}`}
            className="flex items-center gap-2.5 text-fg-muted transition-colors duration-200 hover:text-fg"
          >
            <span className={cn("opacity-80 transition-opacity hover:opacity-100", logo.tone)}>
              {logo.mark}
            </span>
            <span className="text-fluid-sm font-medium tracking-tight">
              {logo.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
