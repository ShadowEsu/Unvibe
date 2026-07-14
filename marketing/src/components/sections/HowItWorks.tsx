"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { MousePointerClick, Sliders, BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Scroll-driven three-step explainer. A tall track holds a sticky visual that transforms
  as you move through Select -> Choose depth -> Learn beside your work. Progress is read
  from useScroll and mapped to a discrete step, so it degrades gracefully: with reduced
  motion or no JS the steps simply stack and remain readable.
*/

const steps = [
  {
    id: "select",
    Icon: MousePointerClick,
    title: "Select the code",
    body: "Highlight a snippet, an active file, or an uncommitted diff. Trigger Unvibe with a keystroke. It reads only what you point it at.",
  },
  {
    id: "depth",
    Icon: Sliders,
    title: "Choose your depth",
    body: "New to code or seasoned engineer, pick the level that fits. The same snippet is explained plainly or with the trade-offs, on demand.",
  },
  {
    id: "learn",
    Icon: BookOpen,
    title: "Learn beside your work",
    body: "A calm widget streams the explanation with citations back to the code, then checks your understanding and saves it to your notebook.",
  },
];

export function HowItWorks() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(steps.length - 1, Math.floor(v * steps.length));
    setStep((prev) => (prev === next ? prev : next));
  });

  return (
    <section id="how-it-works" className="scroll-mt-24">
      <div className="container-page pt-20 sm:pt-28">
        <p className="mb-3 text-fluid-sm font-medium uppercase tracking-[0.18em] text-primary">
          How it works
        </p>
        <h2 className="max-w-2xl text-balance text-fluid-2xl font-semibold text-fg">
          Three quiet steps, right where you are.
        </h2>
      </div>

      <div ref={trackRef} className="container-page relative lg:h-[280vh]">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Steps list */}
          <div className="flex flex-col gap-6 py-12 lg:gap-[70vh] lg:py-[24vh]">
            {steps.map((s, i) => {
              const active = i === step;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "transition-opacity duration-500",
                    "lg:min-h-[10rem]",
                    active ? "opacity-100" : "lg:opacity-40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border text-fluid-sm font-medium transition-colors duration-300",
                        active
                          ? "border-primary bg-primary text-on-primary"
                          : "border-line text-fg-faint"
                      )}
                    >
                      {i + 1}
                    </span>
                    <h3 className="text-fluid-xl font-semibold text-fg">
                      {s.title}
                    </h3>
                  </div>
                  <p className="mt-3 max-w-md text-pretty text-fluid-base leading-relaxed text-fg-muted lg:pl-12">
                    {s.body}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Sticky visual */}
          <div className="hidden lg:block">
            <div className="sticky top-[18vh] flex h-[64vh] items-center">
              <StepVisual step={step} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile visual, stacked under the steps */}
      <div className="container-page pb-12 lg:hidden">
        <StepVisual step={step} />
      </div>
    </section>
  );
}

function StepVisual({ step }: { step: number }) {
  const StepIcon = steps[step].Icon;
  return (
    <div className="w-full overflow-hidden rounded-card border border-line bg-surface shadow-lift">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-4 py-2.5">
        <StepIcon size={15} className="text-primary" aria-hidden="true" />
        <span className="text-fluid-sm font-medium text-fg">
          {steps[step].title}
        </span>
      </div>
      <div className="p-5">
        {step === 0 && (
          <div className="font-mono text-[0.78rem] leading-[1.9]">
            {[
              "const total = items",
              "  .filter(i => i.active)",
              "  .reduce((a, i) => a + i.price, 0);",
            ].map((line, i) => (
              <div
                key={i}
                className={cn(
                  "-mx-2 rounded px-2",
                  i >= 1 && "bg-primary/12 text-fg"
                )}
              >
                <span className="text-fg-muted">{line}</span>
              </div>
            ))}
            <div className="mt-4 inline-flex items-center gap-2 rounded-pill border border-line bg-bg px-3 py-1.5 text-[0.72rem] text-fg shadow-soft">
              <MousePointerClick size={12} className="text-primary" aria-hidden="true" />
              Explain selection
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-3 text-fluid-sm text-fg-muted">Pick a depth</p>
            <div className="flex flex-col gap-2">
              {["New to code", "Beginner", "Intermediate", "Advanced", "Expert"].map(
                (d, i) => (
                  <div
                    key={d}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-fluid-sm",
                      i === 2
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-line text-fg-muted"
                    )}
                  >
                    {d}
                    {i === 2 && <Check size={15} aria-hidden="true" />}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex flex-wrap gap-1.5">
              {["reduce", "filter", "immutability"].map((c) => (
                <span
                  key={c}
                  className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 font-mono text-[0.66rem] text-fg-muted"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-3 text-fluid-sm leading-relaxed text-fg">
              This keeps only active items, then folds them into a single running
              total starting from zero. Nothing is mutated — reduce returns a new
              value.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green/15 text-green">
                <Check size={13} aria-hidden="true" />
              </span>
              <span className="text-fluid-sm text-fg">
                Saved · reduce understood
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
