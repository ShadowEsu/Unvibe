"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoAdvance(count: number, initial: number, delay = 3_000) {
  const [active, setActive] = useState(initial);
  const [cycle, setCycle] = useState(0);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % count);
      setCycle((current) => current + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [count, cycle, delay, inView, reducedMotion]);

  const select = useCallback((index: number) => {
    setActive(index);
    setCycle((current) => current + 1);
  }, []);

  return { active, cycle, rootRef, select };
}
