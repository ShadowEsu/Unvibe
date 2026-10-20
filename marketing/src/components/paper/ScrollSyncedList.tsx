"use client";

import { useEffect, useRef } from "react";
import { prefersLiteExperience } from "@/lib/performanceMode";

interface ScrollSyncedListProps {
  prefix: string;
  items: readonly string[];
}

/**
 * A fixed prefix beside a list that scrolls normally; the line nearest the middle of the
 * screen is underlined. Every line stays fully opaque, including inactive lines.
 * No scroll snapping or hijacking; reduced motion and lite devices skip the scroll work.
 */
export function ScrollSyncedList({ prefix, items }: ScrollSyncedListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || prefersLiteExperience()) return;
    const rows = Array.from(list.children) as HTMLElement[];
    let frame = 0;
    let visible = false;
    const paint = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      rows.forEach((row, index) => {
        const rect = row.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < bestDistance) { best = index; bestDistance = distance; }
      });
      rows.forEach((row, index) => row.classList.toggle("is-lit", index === best));
    };
    const schedule = () => { if (visible && !frame) frame = window.requestAnimationFrame(paint); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    list.classList.add("ssync__list--live");
    observer.observe(list);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      list.classList.remove("ssync__list--live");
      rows.forEach((row) => row.classList.remove("is-lit"));
    };
  }, [items]);

  return (
    <div className="ssync">
      <p className="ssync__prefix">{prefix}</p>
      <ul ref={listRef} className="ssync__list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
