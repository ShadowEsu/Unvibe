"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { prefersLiteExperience } from "@/lib/performanceMode";

/**
 * Wrapper for the homepage's closing download card. The card is visible in the server HTML, so it
 * shows without JS, with reduced motion and on lite devices. Otherwise, when the card starts below
 * the fold, it is armed (hidden) and rises in once as it scrolls into view.
 */
export function InviteReveal({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersLiteExperience()) return;
    if (root.getBoundingClientRect().top < window.innerHeight) return;
    root.classList.add("is-armed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        root.classList.add("is-lit");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      root.classList.remove("is-armed", "is-lit");
    };
  }, []);

  return (
    <div ref={rootRef} className="paper-invite">
      {children}
    </div>
  );
}
