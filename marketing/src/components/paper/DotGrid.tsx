"use client";

import { useEffect, useRef } from "react";
import { prefersLiteExperience } from "@/lib/performanceMode";

const SPACING = 28;
const RADIUS = 150;
const BASE_ALPHA = 0.16;
const PEAK_ALPHA = 0.7;

/**
 * Decorative dot grid that brightens around the pointer. One canvas, drawn only when the
 * pointer moves over the section; static for touch, reduced motion and lite devices.
 * Sits behind the content of its positioned parent and never takes pointer events.
 */
export function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;
    const interactive = window.matchMedia("(pointer: fine)").matches && !prefersLiteExperience();
    let width = 0;
    let height = 0;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    const ink = () => (document.documentElement.classList.contains("dark") ? "242, 238, 249" : "28, 26, 23");
    const draw = () => {
      frame = 0;
      const rgb = ink();
      ctx.clearRect(0, 0, width, height);
      for (let y = SPACING / 2; y < height; y += SPACING) {
        for (let x = SPACING / 2; x < width; x += SPACING) {
          let alpha = BASE_ALPHA;
          let size = 1.3;
          if (pointer) {
            const near = Math.max(0, 1 - Math.hypot(pointer.x - x, pointer.y - y) / RADIUS);
            alpha += (PEAK_ALPHA - BASE_ALPHA) * near * near;
            size += 1.2 * near;
          }
          ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(draw); };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = host.clientWidth;
      height = host.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      schedule();
    };
    const move = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      schedule();
    };
    const leave = () => { pointer = null; schedule(); };

    const sizes = new ResizeObserver(resize);
    sizes.observe(host);
    resize();
    if (interactive) {
      host.addEventListener("pointermove", move, { passive: true });
      host.addEventListener("pointerleave", leave);
    }
    return () => {
      sizes.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className="dotgrid" aria-hidden="true" />;
}
