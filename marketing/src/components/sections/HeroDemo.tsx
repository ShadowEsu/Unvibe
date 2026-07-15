"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { UnvibeBar } from "../UnvibeBar";

/*
  Looping product demo, built entirely in HTML/CSS so it is crisp at any size and needs
  no video asset. A single requestAnimationFrame driver maps elapsed time onto a scripted
  timeline, so pausing is exact and the whole thing loops cleanly (~12.5s).

  Accessibility: a pause/play control is always available, the loop pauses when scrolled
  out of view, and prefers-reduced-motion renders a complete static end state instead of
  animating.
*/

const CODE_LINES = [
  "function useDebouncedSearch(query: string) {",
  "  const [results, setResults] = useState([]);",
  "  useEffect(() => {",
  "    const run = debounce((q: string) => {",
  "      fetchResults(q).then(setResults);",
  "    }, 300);",
  "    run(query);",
  "  }, [query]);",
  "  return results;",
  "}",
];

// Lines 2-6 (0-indexed) are "selected".
const SELECTION = { start: 2, end: 6 };

const CHIPS = ["TypeScript", "React Hook", "State management"];

const EXPLANATION =
  "This hook waits until typing settles, then fetches once. useEffect re-runs when query changes; debounce cancels prior timers so rapid keystrokes do not spam your API.";

const TOTAL = 11000;

// Timeline keyframes in ms matching the launch storyboard.
const T = {
  selectIn: 400,
  barIn: 1050,
  chipsIn: 1650,
  depthIn: 2400,
  streamStart: 3100,
  streamEnd: 5900,
  quizIn: 6550,
  answerIn: 7900,
  collapseIn: 9300,
};

const DEPTHS = ["First time", "Beginner", "Intermediate", "Advanced", "Expert"];
const STAGES = [
  { label: "Select", at: T.selectIn },
  { label: "Recognize", at: T.chipsIn },
  { label: "Choose depth", at: T.depthIn },
  { label: "Explain", at: T.streamStart + 900 },
  { label: "Check", at: T.quizIn },
  { label: "Save", at: T.collapseIn },
] as const;

export function HeroDemo() {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const inViewRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tick = useCallback(
    (now: number) => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = now - lastRef.current;
      lastRef.current = now;
      if (inViewRef.current) {
        setElapsed((prev) => (prev + dt) % TOTAL);
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    []
  );

  useEffect(() => {
    if (reduced || paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [paused, reduced, tick]);

  // Derived state. When reduced, force the final composited frame.
  const e = reduced ? T.collapseIn + 200 : elapsed;

  const selected = e >= T.selectIn;
  const barVisible = e >= T.barIn;
  const chipsVisible = e >= T.chipsIn;
  const depthVisible = e >= T.depthIn;
  const collapsed = e >= T.collapseIn;
  const beginnerSelected = e >= T.depthIn;

  const streamProgress = clamp01(
    (e - T.streamStart) / (T.streamEnd - T.streamStart)
  );
  const charsShown = Math.floor(EXPLANATION.length * streamProgress);
  const streamedText = reduced
    ? EXPLANATION
    : EXPLANATION.slice(0, charsShown);
  const streaming = e >= T.streamStart && e < T.streamEnd && !reduced;

  const quizVisible = e >= T.quizIn;
  const answered = e >= T.answerIn;

  const progressPct = reduced ? 100 : (elapsed / TOTAL) * 100;

  return (
    <div
      ref={containerRef}
      className="relative"
      role="group"
      aria-label="A code selection being explained by Unvibe: concept chips appear, a depth is chosen, an explanation streams in, and a comprehension check is answered correctly."
    >
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-lift">
        {/* window chrome */}
        <div className="flex items-center justify-between border-b border-line bg-surface-2/70 px-4 py-2.5">
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          </span>
          <span className="font-mono text-[0.7rem] text-fg-muted">search.ts</span>
          <span className="w-12" />
        </div>

        <div className="grid gap-0 sm:grid-cols-[1.1fr_1fr]">
          {/* editor */}
          <div className="relative border-b border-line p-4 font-mono text-[0.78rem] leading-[1.85] sm:border-b-0 sm:border-r">
            {CODE_LINES.map((line, i) => {
              const inSel =
                selected && i >= SELECTION.start && i <= SELECTION.end;
              return (
                <div
                  key={i}
                  className={cn(
                    "-mx-2 flex gap-3 rounded px-2 transition-colors duration-300",
                    inSel && "bg-primary/12"
                  )}
                >
                  <span className="select-none text-fg-faint/60">{i + 1}</span>
                  <span
                    className={cn(
                      "whitespace-pre text-fg-muted",
                      inSel && "text-fg"
                    )}
                  >
                    {line}
                  </span>
                </div>
              );
            })}

            {/* floating Unvibe pill — matches the desktop overlay bar */}
            <div
              className={cn(
                "pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 transition-all duration-500 ease-emphatic",
                barVisible
                  ? "bottom-3 scale-100 opacity-100"
                  : "bottom-0 scale-95 opacity-0"
              )}
            >
              <UnvibeBar
                tone="light"
                busy={streaming || (depthVisible && !collapsed && !quizVisible)}
                hint="to explain"
              />
            </div>
          </div>

          {/* explanation widget */}
          <div className="min-h-[16rem] bg-surface p-4">
            {/* recognition chips */}
            <div
              className={cn(
                "flex flex-wrap gap-1.5 transition-opacity duration-300",
                chipsVisible ? "opacity-100" : "opacity-0"
              )}
            >
              {CHIPS.map((chip, i) => (
                <span
                  key={chip}
                  className="rounded-pill border border-line bg-surface-2 px-2 py-0.5 font-mono text-[0.66rem] text-fg-muted transition-all duration-300"
                  style={{
                    transitionDelay: `${i * 80}ms`,
                    opacity: chipsVisible ? 1 : 0,
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>

            {/* depth selector */}
            <div
              className={cn(
                "mt-3 flex flex-wrap gap-1 transition-opacity duration-300",
                depthVisible ? "opacity-100" : "opacity-0"
              )}
            >
              {DEPTHS.map((d) => (
                <span
                  key={d}
                  className={cn(
                    "rounded-pill px-2 py-0.5 text-[0.66rem] transition-colors duration-300",
                    beginnerSelected && d === "Beginner"
                      ? "bg-primary text-on-primary"
                      : "border border-line text-fg-faint"
                  )}
                >
                  {d}
                </span>
              ))}
            </div>

            {/* streaming explanation */}
            {!collapsed && (
              <p className="mt-3 text-[0.8rem] leading-relaxed text-fg">
                {streamedText}
                {streaming && (
                  <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-caret-blink bg-primary align-middle" />
                )}
              </p>
            )}

            {/* Test me + Save actions */}
            {quizVisible && !collapsed && (
              <div className="mt-4 space-y-2 transition-opacity duration-300">
                <div className="flex gap-2">
                  <span className="rounded-pill bg-primary px-2.5 py-1 text-[0.68rem] font-medium text-on-primary">
                    Test me
                  </span>
                  <span className="rounded-pill border border-line px-2.5 py-1 text-[0.68rem] text-fg-muted">
                    Save
                  </span>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                  <p className="text-[0.72rem] font-medium text-fg-muted">
                    Quick check
                  </p>
                  <p className="mt-1 text-[0.76rem] text-fg">
                    Typing five letters quickly triggers how many requests?
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {["Five", "One", "Zero"].map((opt) => {
                      const correct = opt === "One";
                      return (
                        <span
                          key={opt}
                          className={cn(
                            "flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[0.68rem] transition-colors duration-300",
                            answered && correct
                              ? "border-green/50 bg-green/10 text-green"
                              : "border-line text-fg-faint"
                          )}
                        >
                          {answered && correct && (
                            <Check size={11} aria-hidden="true" />
                          )}
                          {opt}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* collapsed persistent card */}
            {collapsed && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface/80 p-3 shadow-soft backdrop-blur-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green/15 text-green">
                  <Check size={13} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[0.76rem] font-medium text-fg">
                    Saved · stays beside your editor
                  </p>
                  <p className="text-[0.68rem] text-fg-muted">
                    useDebouncedSearch · Beginner
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* progress + controls */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play demo" : "Pause demo"}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:text-fg"
          >
            {paused || reduced ? (
              <Play size={13} aria-hidden="true" />
            ) : (
              <Pause size={13} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setElapsed(0);
              setPaused(false);
            }}
            aria-label="Replay demo"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:text-fg"
          >
            <RotateCcw size={12} aria-hidden="true" />
          </button>

          <div className="order-3 flex w-full items-center gap-1.5 sm:order-none sm:w-auto" aria-label="Demo steps">
            {STAGES.map((stage, index) => {
              const activeStage = e >= stage.at && (index === STAGES.length - 1 || e < STAGES[index + 1].at);
              return (
                <button
                  key={stage.label}
                  type="button"
                  onClick={() => {
                    setElapsed(stage.at + 20);
                    setPaused(true);
                  }}
                  aria-label={`Show ${stage.label.toLowerCase()} step`}
                  aria-pressed={activeStage}
                  className={cn(
                    "h-1.5 rounded-full transition-[width,background-color] duration-200",
                    activeStage ? "w-7 bg-primary" : "w-3 bg-line-strong hover:bg-fg-faint"
                  )}
                />
              );
            })}
          </div>

          <div className="h-1 min-w-16 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary/60 transition-[width] duration-100 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-[0.62rem] text-fg-faint">
            {reduced ? "static" : paused ? "manual" : "live demo"}
          </span>
        </div>
      </div>
    </div>
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
