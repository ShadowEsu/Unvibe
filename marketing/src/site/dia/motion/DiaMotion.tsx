"use client";

import { useEffect } from "react";

/**
 * Direction D's scroll-linked motion (Motion; values measured on diabrowser.com). Mount once per D page; it renders
 * nothing and only writes CSS variables and data attributes that dia-motion.css turns into transforms and opacity.
 *
 * - Dock: --d-flat goes 0 → 1 over the first 240 px of scroll (the arch flattens to 80 %, the pill settles to 85 %
 *   and 42 px lower) and back to 0 over the 240 px before the dock comes to rest at the end of [data-d-dock-scope];
 *   --d-glow fades the crest glow over the first 240 px. One rAF per scroll frame, no layout reads while scrolling
 *   (the scope's end is measured on load and resize).
 * - Steps: the shot crossing the viewport's middle is active; its step and shot get data-on. Shots get data-seen the
 *   first time they're in view (their 700 ms fade). Clicking a step scrolls its shot to the middle.
 * Reduced motion: the dock stays round, steps still switch (CSS drops the transitions), shots are all visible.
 */
export function DiaMotion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    // ── Dock
    const dock = document.querySelector<HTMLElement>("[data-d-cta-dock]");
    const scope = dock?.closest<HTMLElement>("[data-d-dock-scope]");
    if (dock && scope && !reduce) {
      const RANGE = 240;
      let restAt = 0;
      const measure = () => {
        restAt = scope.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
      };
      let raf = 0;
      const apply = () => {
        raf = 0;
        const y = window.scrollY;
        const p = Math.min(1, Math.max(0, y / RANGE));
        const q = Math.min(1, Math.max(0, (y - (restAt - RANGE)) / RANGE));
        dock.style.setProperty("--d-flat", Math.max(0, Math.min(p, 1 - q)).toFixed(4));
        dock.style.setProperty("--d-glow", (1 - p).toFixed(4));
      };
      const onScroll = () => {
        if (!raf) raf = requestAnimationFrame(apply);
      };
      const onResize = () => {
        measure();
        onScroll();
      };
      measure();
      apply();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      const ro = new ResizeObserver(onResize);
      ro.observe(scope);
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        ro.disconnect();
        if (raf) cancelAnimationFrame(raf);
      });
    }

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
      const seen = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.setAttribute("data-seen", "");
            seen.unobserve(e.target);
          }
        },
        { threshold: 0.15 },
      );
      for (const s of shots) {
        middle.observe(s);
        seen.observe(s);
      }
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
        seen.disconnect();
        root.removeEventListener("click", onClick);
      });
    }

    // ── Section enter: data-in once 15 % is in view (dia-motion.css runs the blur-up with each element's --d).
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

    // ── Slow zoom (the Brief's Wisteria): 1.00 → 1.06 as its frame crosses the viewport, only while it's in view.
    const zooms = Array.from(document.querySelectorAll<HTMLElement>("[data-d-zoom-slow]"));
    if (zooms.length && !reduce) {
      const live = new Set<HTMLElement>();
      let zraf = 0;
      const apply = () => {
        zraf = 0;
        const vh = window.innerHeight;
        live.forEach((el) => {
          const r = (el.parentElement ?? el).getBoundingClientRect();
          const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
          el.style.transform = `scale(${(1 + 0.06 * p).toFixed(4)})`;
        });
      };
      const onScroll = () => {
        if (!zraf && live.size) zraf = requestAnimationFrame(apply);
      };
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) live.add(e.target as HTMLElement);
          else live.delete(e.target as HTMLElement);
        }
        onScroll();
      });
      for (const el of zooms) io.observe(el);
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => {
        io.disconnect();
        window.removeEventListener("scroll", onScroll);
        if (zraf) cancelAnimationFrame(zraf);
      });
    }

    return () => {
      for (const c of cleanups) c();
    };
  }, []);
  return null;
}
