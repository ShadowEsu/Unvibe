"use client";

import { useEffect, useRef, useState } from "react";

type Shot = { src: string; srcSet?: string; sizes?: string; width: number; height: number; alt: string; wide?: boolean };

const panelShot = (name: string, alt: string): Shot => ({ src: `/unvibe/real/${name}.webp`, width: 880, height: 1131, alt });

/** The 4 steps of using the panel, each with a real capture of the panel at that step. */
const STEPS: ReadonlyArray<{ id: string; title: string; body: string | null; image: Shot }> = [
  {
    id: "explain",
    title: "Select code. Press the shortcut.",
    body: null,
    image: {
      src: "/product/unvibe-0148-debounce-1180.webp",
      srcSet: "/product/unvibe-0148-debounce-720.webp 720w, /product/unvibe-0148-debounce-1180.webp 1180w",
      sizes: "(max-width: 900px) calc(100vw - 40px), 700px",
      width: 1180,
      height: 846,
      alt: "Unvibe 0.1.48 explaining a debounce function beside the code.",
      wide: true,
    },
  },
  {
    id: "depth",
    title: "Pick how deep it goes.",
    body: "New, Beginner, Intermediate and Advanced are free. Expert is part of Pro.",
    image: panelShot("panel-beginner", "The same explanation rewritten at the Beginner depth"),
  },
  {
    id: "ask",
    title: "Ask what still doesn't click.",
    body: "Type a follow-up under the explanation.",
    image: panelShot("panel-follow-up", "A typed follow-up question answered in the Unvibe panel"),
  },
  {
    id: "test",
    title: "Check that it stuck.",
    body: "Test me writes a question about this exact code.",
    image: panelShot("panel-test-me", "A multiple-choice Test me question about the debounce function"),
  },
];

/**
 * "4 steps, 1 panel." (Dia's pattern, Design's vibrant B.) Wide screens: the numbered steps stay pinned
 * on the left while one real capture per step scrolls past on the right; whichever capture crosses the
 * middle of the view makes its step active (a violet rule; the others dim). Phones: a plain stack, each
 * step followed by its capture, all in ink. Server HTML: step 1 active. Reduced motion: every step ink.
 */
export function PanelStory() {
  const grid = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = grid.current;
    if (!root || typeof IntersectionObserver === "undefined") return undefined;
    const figures = Array.from(root.querySelectorAll<HTMLElement>(".b-story__fig"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const figure of figures) io.observe(figure);
    return () => io.disconnect();
  }, []);

  return (
    <section className="b-sec b-story" id="product" aria-labelledby="story-title">
      <div className="b-wrap">
        <h2 id="story-title" className="b-center">4 steps, 1 panel.</h2>
        <div className="b-story__grid" ref={grid}>
          <ol className="b-story__steps">
            {STEPS.map((step, index) => (
              <li key={step.id} className={index === active ? "is-on" : undefined}>
                <span className="b-story__num">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                {step.body ? <p>{step.body}</p> : null}
              </li>
            ))}
          </ol>
          {STEPS.map((step, index) => (
            <figure key={step.id} className="b-story__fig" data-step={index}>
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized real captures, lazy below the fold */}
              <img
                className={step.image.wide ? "b-shot b-shot--wide" : "b-shot"}
                src={step.image.src}
                srcSet={step.image.srcSet}
                sizes={step.image.sizes}
                width={step.image.width}
                height={step.image.height}
                alt={step.image.alt}
                loading="lazy"
                decoding="async"
              />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
