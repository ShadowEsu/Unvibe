"use client";

import { useEffect, useRef } from "react";

/**
 * The purple cursor (plan rev 3, mock 20; ANIMATIONS #6): an 8 px violet dot on the pointer and a 32 px ring that
 * follows about 80 ms behind. Over links and buttons the ring grows to 52 px (white over violet buttons, violet on
 * cream); over the live demo it turns lime. Mouse and trackpad only: it starts on the first fine-pointer move and only
 * where hover exists; text fields, touch, keyboard use and reduced motion keep the system cursor (html.d-cursor hides
 * the system one only while this runs, and never over text inputs). Transform and opacity only; the rAF loop runs
 * only while the ring is catching up.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const d = dot.current;
    const r = ring.current;
    if (!d || !r) return undefined;
    const html = document.documentElement;
    let on = false;
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0, last = 0;
    const stop = () => {
      on = false;
      html.classList.remove("d-cursor");
      d.removeAttribute("data-on");
      r.removeAttribute("data-on");
    };
    const step = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      // ≈ 80 ms to close most of the gap (exponential follow)
      const k = 1 - Math.exp(-dt / 40);
      rx += (x - rx) * k;
      ry += (y - ry) * k;
      r.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      if (Math.abs(x - rx) + Math.abs(y - ry) > 0.3) raf = requestAnimationFrame(step);
      else { raf = 0; last = 0; }
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !fine.matches || reduce.matches) {
        if (on) stop();
        return;
      }
      x = event.clientX;
      y = event.clientY;
      if (!on) {
        on = true;
        rx = x;
        ry = y;
        html.classList.add("d-cursor");
        d.setAttribute("data-on", "");
        r.setAttribute("data-on", "");
      }
      d.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const target = event.target instanceof Element ? event.target : null;
      const text = target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");
      const link = !text && target?.closest("a, button, summary, [role='button'], label");
      const demo = !text && !link && target?.closest(".ud");
      const onViolet = link && link.matches(".d-cta, .d-btn, .dh__cta, .dp__btn--violet, [data-dl]");
      r.dataset.state = text ? "text" : demo ? "demo" : link ? (onViolet ? "violet" : "link") : "";
      d.dataset.state = r.dataset.state;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onLeave = () => {
      d.removeAttribute("data-on");
      r.removeAttribute("data-on");
    };
    const onEnter = () => {
      if (!on) return;
      d.setAttribute("data-on", "");
      r.setAttribute("data-on", "");
    };
    const onKey = (event: KeyboardEvent) => {
      if (on && event.key === "Tab") stop();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.documentElement.addEventListener("pointerenter", onEnter);
    window.addEventListener("keydown", onKey);
    const onReduce = () => reduce.matches && stop();
    reduce.addEventListener("change", onReduce);
    return () => {
      stop();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.removeEventListener("pointerenter", onEnter);
      window.removeEventListener("keydown", onKey);
      reduce.removeEventListener("change", onReduce);
    };
  }, []);
  return (
    <>
      <div ref={ring} className="dc-ring" aria-hidden="true"><span /></div>
      <div ref={dot} className="dc-dot" aria-hidden="true"><span /></div>
    </>
  );
}
