"use client";

import { useEffect } from "react";

/**
 * Direction D's scroll-linked motion (Motion; values measured on diabrowser.com). Mount once per D page; it renders
 * nothing and only writes CSS variables and data attributes that dia-motion.css turns into transforms and opacity.
 *
 * - Dock (Dia, measured): --d-flat goes 0 → 1 over the first 200 px of scroll (the arch flattens to 80 %, the pill
 *   settles to 85 % and lower) and back to 0 over the 300 px before the dock comes to rest at the end of
 *   [data-d-dock-scope]; --d-glow fades the crest glow out by 180 px. One rAF per scroll frame, no layout reads while
 *   scrolling (the scope's end is measured on load and resize).
 * - Wordmark parallax: −0.35 × scrollY on the `translate` property above 800 px.
 * - Dock rim: --d-rim = smoothstep(--d-flat) on a [data-d-dock-rim] element it adds inside the arch.
 * - Hero light: a small canvas of drifting dappled light inside [data-d-hero-bg] (30 fps, paused off-screen and on a
 *   hidden tab; not created under reduced motion).
 * - Word reveal / pixel draw-on: splits [data-d-words] headings into word spans; [data-d-words] and [data-d-pixel] get
 *   data-in on enter, like [data-d-enter].
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
      const RANGE = 200; // Dia: t = scrollY / 200
      const REST = 300; // Dia: t runs back 1 → 0 over the last 300 px before the dock rests
      let restAt = 0;
      const measure = () => {
        restAt = scope.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
      };
      let raf = 0;
      // The rim line (Dia: thin upward shadows on the arch, fading in as it flattens): decorative, so added here.
      const arc = dock.querySelector<HTMLElement>("[data-d-dock-arc]");
      const rim = document.createElement("div");
      rim.setAttribute("data-d-dock-rim", "");
      arc?.appendChild(rim);
      const apply = () => {
        raf = 0;
        const y = window.scrollY;
        const p = Math.min(1, Math.max(0, y / RANGE));
        const q = Math.min(1, Math.max(0, (y - (restAt - REST)) / REST));
        const f = Math.max(0, Math.min(p, 1 - q));
        dock.style.setProperty("--d-flat", f.toFixed(4));
        dock.style.setProperty("--d-glow", Math.max(0, 1 - p / 0.9).toFixed(4)); // Dia: gone at 90 % of the flatten
        dock.style.setProperty("--d-rim", (f * f * (3 - 2 * f)).toFixed(4)); // Dia: smoothstep of the flatten
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
        rim.remove();
      });
    }

    // ── Wordmark parallax (Dia: translateY = −0.35 × scrollY, none ≤ 800 px). Written to the `translate` property, which
    //    composes with the rise animation's `transform` instead of being overridden by its fill. Only while the hero
    //    can be on screen; one rAF per scroll frame.
    const mark = document.querySelector<HTMLElement>('[data-d-hero-rise="wordmark"]');
    const wide = window.matchMedia("(min-width: 801px)");
    if (mark && !reduce) {
      let praf = 0;
      const apply = () => {
        praf = 0;
        const y = window.scrollY;
        if (!wide.matches) {
          mark.style.translate = "";
          return;
        }
        if (y > window.innerHeight * 1.5) return;
        mark.style.translate = y > 0 ? `0 ${(-0.35 * y).toFixed(1)}px` : "";
      };
      const onScroll = () => {
        if (!praf) praf = requestAnimationFrame(apply);
      };
      apply();
      window.addEventListener("scroll", onScroll, { passive: true });
      wide.addEventListener("change", onScroll);
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        wide.removeEventListener("change", onScroll);
        if (praf) cancelAnimationFrame(praf);
      });
    }

    // ── Hero light (Dia's hero light is a live canvas; Design: ≤ 2 ms a frame, paused off-screen and on a hidden tab,
    //    reduced motion keeps the still). A 192 × 120 canvas (CSS upscales it, so it's soft) inside the bubbles layer:
    //    a lilac light wash with ~11 leaf shadows carved out of it, each drifting on its own slow ellipse (9-23 s) and
    //    breathing; 30 fps. Seeded, so every load looks alike. Canvases are never LCP candidates.
    const heroBg = document.querySelector<HTMLElement>("[data-d-hero-bg]");
    if (heroBg && !reduce) {
      const cv = document.createElement("canvas");
      cv.width = 192;
      cv.height = 120;
      cv.setAttribute("data-d-hero-light", "");
      cv.setAttribute("aria-hidden", "true");
      heroBg.appendChild(cv);
      const ctx = cv.getContext("2d");
      const leaves = Array.from({ length: 11 }, (_, i) => {
        const r = (n: number) => {
          const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return { x: r(1), y: r(2), ax: 0.05 + 0.08 * r(3), ay: 0.04 + 0.07 * r(4), px: 9 + 14 * r(5), py: 11 + 12 * r(6), ph: 6.2832 * r(7), s: 0.1 + 0.08 * r(8), sx: 1.2 + 0.9 * r(9) };
      });
      let lraf = 0;
      let last = -1e9;
      let onScreen = true;
      const paint = (now: number) => {
        if (!ctx) return;
        const t = now / 1000;
        const W = cv.width;
        const H = cv.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, W, H);
        const wash = ctx.createLinearGradient(0, 0, W, H);
        wash.addColorStop(0, "rgba(245, 238, 255, 0.55)");
        wash.addColorStop(1, "rgba(225, 212, 255, 0.35)");
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "destination-out";
        for (const l of leaves) {
          const cx = (l.x + l.ax * Math.sin((t * 6.2832) / l.px + l.ph)) * W;
          const cy = (l.y + l.ay * Math.cos((t * 6.2832) / l.py + l.ph)) * H;
          const rad = (l.s + 0.02 * Math.sin(t * 0.7 + l.ph)) * W;
          ctx.setTransform(l.sx, 0, 0, 1, cx, cy); // leaves are wider than tall
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
          g.addColorStop(0, "rgba(0, 0, 0, 0.95)");
          g.addColorStop(0.55, "rgba(0, 0, 0, 0.7)");
          g.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, rad, 0, 6.2832);
          ctx.fill();
        }
      };
      const frame = (now: number) => {
        lraf = 0;
        if (now - last >= 33) {
          last = now;
          paint(now);
        }
        if (onScreen && !document.hidden) lraf = requestAnimationFrame(frame);
      };
      const wake = () => {
        if (!lraf && onScreen && !document.hidden) lraf = requestAnimationFrame(frame);
      };
      const io = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        wake();
      });
      io.observe(heroBg);
      document.addEventListener("visibilitychange", wake);
      wake();
      cleanups.push(() => {
        io.disconnect();
        document.removeEventListener("visibilitychange", wake);
        if (lraf) cancelAnimationFrame(lraf);
        cv.remove();
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

    // ── H2 word reveal (Maze): wrap each word of [data-d-words] in a .d-wd span with --i = its index. Text nodes only, so
    //    inner elements (italic words, the OS-aware shortcut spans) stay; use it on static headings only (React doesn't
    //    re-render them, so the split text is safe).
    if (!reduce) {
      for (const h of Array.from(document.querySelectorAll<HTMLElement>("[data-d-words]"))) {
        if (h.querySelector(".d-wd")) continue;
        const texts: Text[] = [];
        const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
        let i = 0;
        for (const tn of texts) {
          const parts = (tn.textContent ?? "").split(/(\s+)/);
          if (!parts.some((p) => p.trim())) continue;
          const frag = document.createDocumentFragment();
          for (const p of parts) {
            if (!p) continue;
            if (!p.trim()) {
              frag.appendChild(document.createTextNode(p));
              continue;
            }
            const s = document.createElement("span");
            s.className = "d-wd";
            // punctuation-only tokens (", " after an italic word) fade with the word before them
            s.style.setProperty("--i", String(/[A-Za-z0-9\u00C0-\u024F]/.test(p) ? i++ : Math.max(0, i - 1)));
            s.textContent = p;
            frag.appendChild(s);
          }
          tn.replaceWith(frag);
        }
      }
    }

    // ── Section enter: data-in once 15 % is in view. dia-motion.css runs the blur-up ([data-d-enter], with each
    //    element's --d), the word reveal ([data-d-words]) and the pixel draw-on ([data-d-pixel]).
    const enters = Array.from(document.querySelectorAll<HTMLElement>("[data-d-enter], [data-d-words], [data-d-pixel]"));
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
