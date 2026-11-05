"use client";

import { useEffect, useRef, useState } from "react";
import { Arrive } from "@/components/paper/Arrive";
import { STEPS } from "@/data/howItWorks";

/** Step 1's picture is the whole app beside the editor; the other steps show the panel at that moment. */
const WIDE = { src: "/product/unvibe-0148-debounce-1180.webp", width: 1180, height: 846, alt: "Unvibe 0.1.48 explaining a debounce function beside the code." };

/**
 * How it works, Design N: the numbered steps pinned on the left, the active one ruled, and one real capture on the
 * right that changes as you scroll (a sentinel per step crossing the middle of the view picks it). Phones and
 * narrow windows get a plain stack, step then capture. Reduced motion swaps the captures without a slide or fade.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const marks = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = marks.current;
    if (!root || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const mark of Array.from(root.children)) io.observe(mark);
    return () => io.disconnect();
  }, []);

  return (
    <section className="n-sec n-wrap nstory" id="product" aria-labelledby="story-title">
      <Arrive className="n-head n-center">
        <h2 id="story-title">{STEPS.length} steps, 1 panel.</h2>
      </Arrive>
      <div className="nstory__track">
        <div className="nstory__pin">
          <ol className="nstory__steps">
            {STEPS.map((step, index) => (
              <li key={step.id} className={index === active ? "is-on" : undefined} aria-current={index === active ? "step" : undefined}>
                <span className="nstory__num">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                {step.body ? <p>{step.body}</p> : null}
              </li>
            ))}
          </ol>
          <div className="nstory__figs">
            {STEPS.map((step, index) => {
              const image = index === 0 ? WIDE : step.image;
              const state = index === active ? "is-on" : index < active ? "is-past" : "";
              return (
                // eslint-disable-next-line @next/next/no-img-element -- fixed-size real captures
                <img
                  key={step.id}
                  className={[index === 0 ? "is-wide" : "", state].filter(Boolean).join(" ") || undefined}
                  src={image.src}
                  width={image.width}
                  height={image.height}
                  alt={image.alt}
                  loading="lazy"
                  decoding="async"
                />
              );
            })}
          </div>
        </div>
        <div className="nstory__marks" ref={marks} aria-hidden="true">
          {STEPS.map((step, index) => (
            <i key={step.id} data-step={index} style={{ top: `${index * 440}px` }} />
          ))}
        </div>
      </div>
    </section>
  );
}
