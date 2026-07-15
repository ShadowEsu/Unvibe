"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Section } from "../Section";
import { CodeCard } from "../CodeCard";
import { cn } from "@/lib/utils";
import { durations, easing } from "@/lib/motion";
import { track } from "@/lib/analytics";
import {
  depthLabels,
  depthOrder,
  examples,
  type Depth,
} from "@/lib/examples";

export function DepthDemo() {
  const [exampleId, setExampleId] = useState(examples[0].id);
  const [depth, setDepth] = useState<Depth>("beginner");

  const example = examples.find((e) => e.id === exampleId) ?? examples[0];

  return (
    <Section
      id="depth"
      eyebrow="One snippet, five depths"
      title="From first day to staff engineer, on the same line of code."
      subtitle="Drag the depth from New to Expert and watch the explanation change. Nothing about the code moves — only how much it assumes you already know."
    >
      {/* Example selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex.id}
            onClick={() => {
              setExampleId(ex.id);
              track("code_example_selected", { example: ex.id });
            }}
            aria-pressed={ex.id === exampleId}
            className={cn(
              "rounded-pill border px-4 py-2 text-fluid-sm font-medium transition-all duration-200",
              ex.id === exampleId
                ? "border-primary bg-primary text-on-primary shadow-glow"
                : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
            )}
          >
            {ex.chip}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div>
          <CodeCard
            code={example.code}
            language={example.language}
            filename={`${example.id}.${extFor(example.language)}`}
          />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {example.concepts.map((c) => (
              <span
                key={c}
                className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 font-mono text-[0.68rem] text-fg-muted"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          {/* Depth control */}
          <div
            role="radiogroup"
            aria-label="Explanation depth"
            className="mb-5 grid grid-cols-5 gap-1 rounded-pill border border-line bg-surface p-1"
          >
            {depthOrder.map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={depth === d}
                onClick={() => {
                  setDepth(d);
                  track("depth_changed", { depth: d, example: example.id });
                }}
                className={cn(
                  "rounded-pill px-1 py-2 text-[0.68rem] font-medium transition-all duration-200 sm:text-fluid-sm",
                  depth === d
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-fg-muted hover:text-fg"
                )}
              >
                <span className="hidden sm:inline">{depthLabels[d]}</span>
                <span className="sm:hidden">{shortDepth(d)}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 rounded-card border border-line bg-surface p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="rounded-pill bg-primary-soft px-3 py-1 text-fluid-sm font-medium text-primary">
                {depthLabels[depth]}
              </span>
              <span className="text-fluid-sm text-fg-faint">explanation</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`${example.id}-${depth}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: durations.standard, ease: easing.calm }}
                className="text-pretty text-fluid-base leading-relaxed text-fg"
              >
                {example.explanations[depth]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Section>
  );
}

function shortDepth(d: Depth): string {
  const map: Record<Depth, string> = {
    new: "New",
    beginner: "Beg",
    intermediate: "Int",
    advanced: "Adv",
    expert: "Exp",
  };
  return map[d];
}

function extFor(language: string): string {
  const map: Record<string, string> = {
    typescript: "ts",
    tsx: "tsx",
    javascript: "js",
    python: "py",
    sql: "sql",
  };
  return map[language] ?? "txt";
}
