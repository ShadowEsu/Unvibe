"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { observeMotion } from "@/lib/motionInView";
import { arrivingItems, prefersReducedMotion, stageArrival } from "@/lib/motionMoments";

/**
 * A list whose first 8 children arrive one after another the first time it scrolls into view (motion
 * spec §2: opacity and an --m-dist-sm rise, --m-normal, --m-stagger apart; CSS in globals.css). The
 * server HTML shows every item. The start state goes on only when motion is allowed and the list starts
 * below the fold; it runs once per mount, never on a re-render. Transforms and opacity only, so CLS 0.
 */
export function Arrive({ className, children, ...rest }: { className?: string; children: ReactNode } & Pick<HTMLAttributes<HTMLDivElement>, "role" | "aria-label">) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || root.dataset.arrive) return;
    const staged = stageArrival({
      reducedMotion: prefersReducedMotion(),
      hasObserver: typeof IntersectionObserver !== "undefined",
      top: root.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
    });
    if (!staged) return;
    for (const i of arrivingItems(root.children.length)) {
      const item = root.children[i] as HTMLElement;
      item.dataset.arriveItem = "";
      item.style.setProperty("--arrive-i", String(i));
    }
    root.dataset.arrive = "wait";
    const stop = observeMotion(root, () => {
      stop();
      root.dataset.arrive = "go";
    });
    // Torn down before it ran (React's dev double effect): take the start state off so nothing stays hidden.
    return () => {
      stop();
      if (root.dataset.arrive === "wait") delete root.dataset.arrive;
    };
  }, []);

  return <div ref={ref} className={className} {...rest}>{children}</div>;
}
