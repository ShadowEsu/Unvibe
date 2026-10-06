"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";

const SLIDES = Array.from({ length: 14 }, (_, i) => `/investors/slides/slide-${String(i + 1).padStart(2, "0")}.jpg`);

/** The pitch deck, readable right on the page: arrows, keyboard and swipe, plus the PDF. */
export function DeckViewer({ pdf }: { pdf: string }) {
  const [index, setIndex] = useState(0);
  const touch = useRef<number | null>(null);
  const go = useCallback((delta: number) => setIndex((i) => Math.min(SLIDES.length - 1, Math.max(0, i + delta))), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div className="deckv">
      <div
        className="deckv__stage"
        onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const start = touch.current;
          const end = e.changedTouches[0]?.clientX;
          if (start != null && end != null && Math.abs(end - start) > 40) go(end < start ? 1 : -1);
          touch.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static slide images, sized by CSS */}
        <img src={SLIDES[index]} alt={`Pitch deck slide ${index + 1} of ${SLIDES.length}`} width={1600} height={900} />
        <button type="button" className="deckv__nav deckv__nav--prev" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous slide"><ArrowLeft size={22} /></button>
        <button type="button" className="deckv__nav deckv__nav--next" onClick={() => go(1)} disabled={index === SLIDES.length - 1} aria-label="Next slide"><ArrowRight size={22} /></button>
      </div>
      <div className="deckv__bar">
        <span className="deckv__count">{index + 1} / {SLIDES.length}</span>
        <div className="deckv__thumbs" role="tablist" aria-label="Slides">
          {SLIDES.map((src, i) => (
            <button key={src} type="button" role="tab" aria-selected={i === index} aria-label={`Slide ${i + 1}`} className={i === index ? "is-on" : ""} onClick={() => setIndex(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny thumbnails */}
              <img src={src} alt="" loading="lazy" width={160} height={90} />
            </button>
          ))}
        </div>
        <a className="inv-btn inv-btn--ink" href={pdf} target="_blank" rel="noopener noreferrer"><Download size={17} /> PDF</a>
      </div>
    </div>
  );
}
