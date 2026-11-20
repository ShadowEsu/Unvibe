"use client";

import { useEffect } from "react";

/**
 * Option A's motion driver. Mount once per page; it renders nothing and only writes data attributes that
 * dia-motion.css turns into opacity and transforms.
 *
 * - Reveal: [data-d-enter] gets data-in once 15 % of it is in view (the one-time 16 px slide-fade).
 * - Steps: the marker crossing the viewport's middle is active; its step and marker get data-on. Clicking a step
 *   scrolls its marker to the middle.
 * Reduced motion: CSS shows everything at once; steps still switch, without transitions.
 */
export function DiaMotion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    // ── Steps
    for (const root of Array.from(document.querySelectorAll<HTMLElement>("[data-d-steps]"))) {
      const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-d-step]"));
      const shots = Array.from(root.querySelectorAll<HTMLElement>("[data-d-shot]"));
      const set = (i: string) => {
        for (const el of steps.concat(shots)) {
          const on = (el.dataset.dStep ?? el.dataset.dShot) === i;
          el.toggleAttribute("data-on", on);
          if (el.dataset.dStep !== undefined) el.setAttribute("aria-current", on ? "step" : "false");
        }
      };
      set("0");
      const middle = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) set((e.target as HTMLElement).dataset.dShot ?? "0");
        },
        { rootMargin: "-50% 0px -50% 0px" },
      );
      for (const s of shots) middle.observe(s);
      const onClick = (ev: MouseEvent) => {
        const step = (ev.target as HTMLElement).closest<HTMLElement>("[data-d-step]");
        if (!step) return;
        const shot = shots.find((s) => s.dataset.dShot === step.dataset.dStep);
        if (!shot) return;
        ev.preventDefault();
        shot.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      };
      root.addEventListener("click", onClick);
      cleanups.push(() => {
        middle.disconnect();
        root.removeEventListener("click", onClick);
      });
    }

    // ── Reveal: data-in once 15 % is in view.
    const enters = Array.from(document.querySelectorAll<HTMLElement>("[data-d-enter]"));
    if (enters.length) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.setAttribute("data-in", "");
            io.unobserve(e.target);
          }
        },
        { threshold: 0.15 },
      );
      for (const el of enters) io.observe(el);
      cleanups.push(() => io.disconnect());
    }

    return () => {
      for (const c of cleanups) c();
    };
  }, []);
  return null;
}
