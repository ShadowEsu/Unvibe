"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, RotateCcw, Play, Pause, Check } from "lucide-react";
import { Section } from "../Section";
import { CodeCard } from "../CodeCard";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { examples, depthLabels, type Depth } from "@/lib/examples";

const steps = [
  { key: "select", label: "Select" },
  { key: "concepts", label: "Concepts" },
  { key: "depth", label: "Depth" },
  { key: "explain", label: "Explanation" },
  { key: "check", label: "Test me" },
  { key: "save", label: "Save" },
] as const;

const DEPTH: Depth = "intermediate";

export function DemoSection() {
  const example = examples[0]; // debounce
  const [step, setStep] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [startedTracked, setStartedTracked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const atEnd = step === steps.length - 1;

  const advance = () => {
    if (!startedTracked) {
      setStartedTracked(true);
      track("demo_started", { source: "demo-section" });
    }
    setStep((s) => {
      const next = Math.min(steps.length - 1, s + 1);
      if (next === steps.length - 1 && s !== next) {
        track("demo_completed");
      }
      return next;
    });
  };

  const reset = () => {
    setStep(0);
    setAutoplay(false);
  };

  useEffect(() => {
    if (!autoplay) return;
    if (atEnd) {
      setAutoplay(false);
      return;
    }
    timerRef.current = setTimeout(advance, 1800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // advance intentionally not in deps; it is stable enough for this timeline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, step, atEnd]);

  return (
    <Section
      id="demo"
      eyebrow="See the whole loop"
      title="Walk through it yourself."
      subtitle="Step through the exact flow — select code, choose a depth, read the explanation, and prove you understood it. Drive it manually, or let it play."
    >
      <div className="rounded-card border border-line bg-surface p-4 sm:p-6">
        {/* Step rail */}
        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <button
                onClick={() => setStep(i)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-pill px-3 py-1.5 text-fluid-sm transition-colors",
                  i === step
                    ? "bg-primary text-on-primary"
                    : i < step
                      ? "text-fg"
                      : "text-fg-faint"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[0.66rem]",
                    i < step ? "bg-green/20 text-green" : "bg-surface-2"
                  )}
                >
                  {i < step ? <Check size={11} aria-hidden="true" /> : i + 1}
                </span>
                {s.label}
              </button>
              {i < steps.length - 1 && (
                <ChevronRight size={14} className="text-fg-faint" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Left: editor */}
          <div>
            <CodeCard
              code={example.code}
              filename="debounce.ts"
              addedLines={step >= 0 ? [] : []}
            />
            {step >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex flex-wrap gap-1.5"
              >
                {example.concepts.map((c) => (
                  <span
                    key={c}
                    className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 font-mono text-[0.66rem] text-fg-muted"
                  >
                    {c}
                  </span>
                ))}
              </motion.div>
            )}
          </div>

          {/* Right: widget */}
          <div className="min-h-[18rem] rounded-card border border-line bg-surface-2/40 p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {step === 0 && (
                  <Placeholder text="Select the debounce helper and trigger Unvibe with a keystroke." />
                )}
                {step === 1 && (
                  <Placeholder text="Unvibe identifies the concepts at play, shown as chips beside your code." />
                )}
                {step === 2 && (
                  <div>
                    <p className="mb-3 text-fluid-sm text-fg-muted">Choose a depth</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(["beginner", "intermediate", "advanced"] as Depth[]).map((d) => (
                        <span
                          key={d}
                          className={cn(
                            "rounded-pill px-3 py-1 text-fluid-sm",
                            d === DEPTH
                              ? "bg-primary text-on-primary"
                              : "border border-line text-fg-faint"
                          )}
                        >
                          {depthLabels[d]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {step === 3 && (
                  <div>
                    <span className="rounded-pill bg-primary-soft px-2.5 py-0.5 text-fluid-sm font-medium text-primary">
                      {depthLabels[DEPTH]}
                    </span>
                    <p className="mt-3 text-fluid-base leading-relaxed text-fg">
                      {example.explanations[DEPTH]}
                    </p>
                  </div>
                )}
                {step === 4 && (
                  <div>
                    <p className="text-fluid-sm font-medium text-fg-muted">
                      Quick check
                    </p>
                    <p className="mt-1 text-fluid-base text-fg">
                      {example.comprehension.question}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {example.comprehension.options.map((opt, i) => (
                        <span
                          key={opt}
                          className={cn(
                            "flex items-center justify-between rounded-xl border px-3 py-2 text-fluid-sm",
                            i === example.comprehension.answerIndex
                              ? "border-green/50 bg-green/10 text-green"
                              : "border-line text-fg-muted"
                          )}
                        >
                          {opt}
                          {i === example.comprehension.answerIndex && (
                            <Check size={15} aria-hidden="true" />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {step === 5 && (
                  <div className="flex flex-col items-start gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green/15 text-green">
                      <Check size={24} aria-hidden="true" />
                    </span>
                    <p className="text-fluid-lg font-medium text-fg">
                      Saved to your notebook
                    </p>
                    <p className="text-fluid-sm text-fg-muted">
                      debounce · understood · added to your concept profile. That is
                      the whole loop.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => setAutoplay((a) => !a)}
            disabled={atEnd}
            className="inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-fluid-sm text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            {autoplay ? (
              <>
                <Pause size={15} aria-hidden="true" /> Pause
              </>
            ) : (
              <>
                <Play size={15} aria-hidden="true" /> Play
              </>
            )}
          </button>

          {atEnd ? (
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-pill border border-line px-4 py-2 text-fluid-sm text-fg hover:bg-surface-2"
            >
              <RotateCcw size={15} aria-hidden="true" /> Replay
            </button>
          ) : (
            <button
              onClick={advance}
              className="inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2 text-fluid-sm font-medium text-on-primary hover:bg-primary-strong"
            >
              Next <ChevronRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center text-center">
      <p className="max-w-xs text-fluid-base leading-relaxed text-fg-muted">
        {text}
      </p>
    </div>
  );
}
