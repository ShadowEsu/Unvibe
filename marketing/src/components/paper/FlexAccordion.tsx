"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { GlassPlate } from "@/components/glass/GlassPlate";
import { Arrive } from "@/components/paper/Arrive";

export interface FlexAccordionItem {
  id: string;
  /** Short label shown on the collapsed spine. */
  label: string;
  title: string;
  /** One line under the title; none when the title says it all. */
  body?: string;
  image: { src: string; width: number; height: number; alt: string };
}

interface FlexAccordionProps {
  items: readonly FlexAccordionItem[];
  /** "tall" for panel screenshots (text beside the image), "wide" for full-window shots. */
  shape: "tall" | "wide";
  label: string;
  /** Number the spines (01, 02…) only when the items are a real sequence, like steps. */
  numbered?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Horizontal accordion of real screenshots: one panel open, the rest folded into spines (numbered for steps).
 * Stacks vertically on narrow screens, and the items arrive one after another (Arrive, arrive--plate).
 * Headers are real buttons with aria-expanded, and arrow keys move between them, so it works the same
 * with a keyboard or a screen reader.
 */
export function FlexAccordion({ items, shape, label, numbered = true }: FlexAccordionProps) {
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
    <Arrive className={`flexacc flexacc--${shape} arrive--plate`} role="group" aria-label={label}>
      {items.map((item, index) => {
        const isOpen = index === open;
        const headId = `${base}-h-${item.id}`;
        const bodyId = `${base}-b-${item.id}`;
        return (
          <article key={item.id} className={isOpen ? "flexacc__item is-open" : "flexacc__item"}>
            <GlassPlate />
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
                {numbered ? <span className="flexacc__num">{pad(index + 1)}</span> : null}
                <span className="flexacc__label">{item.label}</span>
              </button>
            </h3>
            <div id={bodyId} role="region" aria-labelledby={headId} className="flexacc__body" hidden={!isOpen}>
              <div className="flexacc__copy">
                {numbered ? <p className="flexacc__count" aria-hidden="true">{pad(index + 1)} / {pad(items.length)}</p> : null}
                <p className="flexacc__title">{item.title}</p>
                {item.body ? <p className="flexacc__text">{item.body}</p> : null}
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
    </Arrive>
  );
}
