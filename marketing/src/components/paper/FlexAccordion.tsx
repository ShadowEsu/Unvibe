"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

export interface FlexAccordionItem {
  id: string;
  /** Short label shown on the collapsed spine. */
  label: string;
  title: string;
  body: string;
  image: { src: string; width: number; height: number; alt: string };
}

interface FlexAccordionProps {
  items: readonly FlexAccordionItem[];
  /** "tall" for panel screenshots (text beside the image), "wide" for full-window shots. */
  shape: "tall" | "wide";
  label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Horizontal accordion of real screenshots: one panel open, the rest folded into numbered spines.
 * Stacks vertically on narrow screens. Headers are real buttons with aria-expanded, and arrow
 * keys move between them, so it works the same with a keyboard or a screen reader.
 */
export function FlexAccordion({ items, shape, label }: FlexAccordionProps) {
  const [open, setOpen] = useState(0);
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const jump = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
    if (step === undefined && jump === null) return;
    event.preventDefault();
    const next = jump ?? (index + step! + items.length) % items.length;
    setOpen(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className={`flexacc flexacc--${shape}`} role="group" aria-label={label}>
      {items.map((item, index) => {
        const isOpen = index === open;
        const headId = `${base}-h-${item.id}`;
        const bodyId = `${base}-b-${item.id}`;
        return (
          <article key={item.id} className={isOpen ? "flexacc__item is-open" : "flexacc__item"}>
            <h3 className="flexacc__head">
              <button
                ref={(node) => { buttons.current[index] = node; }}
                id={headId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => setOpen(index)}
                onKeyDown={(event) => onKey(event, index)}
              >
                <span className="flexacc__num">{pad(index + 1)}</span>
                <span className="flexacc__label">{item.label}</span>
              </button>
            </h3>
            <div id={bodyId} role="region" aria-labelledby={headId} className="flexacc__body" hidden={!isOpen}>
              <div className="flexacc__copy">
                <p className="flexacc__count" aria-hidden="true">{pad(index + 1)} / {pad(items.length)}</p>
                <p className="flexacc__title">{item.title}</p>
                <p className="flexacc__text">{item.body}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized webp screenshots, lazy below the fold */}
              <img
                className="flexacc__shot"
                src={item.image.src}
                width={item.image.width}
                height={item.image.height}
                alt={item.image.alt}
                loading="lazy"
                decoding="async"
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
