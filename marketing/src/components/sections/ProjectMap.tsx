"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import { durations, easing } from "@/lib/motion";

interface Scope {
  id: string;
  label: string;
  size: string;
  detail: string;
}

const scopes: Scope[] = [
  {
    id: "line",
    label: "Line",
    size: "1 statement",
    detail:
      "What does this exact line do? Unvibe reads the statement and just enough around it to make the answer honest.",
  },
  {
    id: "function",
    label: "Function",
    size: "the enclosing scope",
    detail:
      "The whole function, its parameters, and what it returns. Good for understanding a unit of behavior end to end.",
  },
  {
    id: "file",
    label: "File",
    size: "imports + structure",
    detail:
      "The file's imports and the shape of what it exports, so an explanation can reference the pieces it depends on.",
  },
  {
    id: "diff",
    label: "Change",
    size: "the uncommitted diff",
    detail:
      "Only what changed. Perfect right after an agent edit — see the intent behind the diff you are about to accept.",
  },
  {
    id: "repository",
    label: "Repository",
    size: "a lightweight summary",
    detail:
      "A shallow map of the project — never the whole codebase — so explanations use the right vocabulary for your app.",
  },
];

export function ProjectMap() {
  const [active, setActive] = useState(scopes[0].id);
  const current = scopes.find((s) => s.id === active) ?? scopes[0];
  const activeIndex = scopes.findIndex((s) => s.id === active);

  return (
    <Section
      eyebrow="Context that scales"
      title="From one line to the whole repository."
      subtitle="Understanding a change often means understanding what surrounds it. Choose how wide to look — Unvibe builds context locally and only sends what you approve."
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        {/* Nested hierarchy visual */}
        <div className="relative">
          {scopes.map((scope, i) => {
            const isActive = scope.id === active;
            const within = i <= activeIndex;
            return (
              <button
                key={scope.id}
                onClick={() => setActive(scope.id)}
                aria-pressed={isActive}
                className="block w-full text-left"
                style={{ paddingLeft: `${i * 1.25}rem` }}
              >
                <div
                  className={cn(
                    "my-1 flex items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-standard",
                    isActive
                      ? "border-primary bg-primary-soft"
                      : within
                        ? "border-line-strong bg-surface-2"
                        : "border-line bg-surface"
                  )}
                >
                  <span
                    className={cn(
                      "text-fluid-base font-medium",
                      isActive ? "text-primary" : "text-fg"
                    )}
                  >
                    {scope.label}
                  </span>
                  <span className="font-mono text-[0.7rem] text-fg-faint">
                    {scope.size}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="rounded-card border border-line bg-surface p-6">
          <div className="flex items-baseline gap-3">
            <span className="text-fluid-xl font-semibold text-fg">
              {current.label}
            </span>
            <span className="font-mono text-fluid-sm text-primary">
              {current.size}
            </span>
          </div>
          <motion.p
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.standardFast, ease: easing.calm }}
            className="mt-3 text-pretty text-fluid-base leading-relaxed text-fg-muted"
          >
            {current.detail}
          </motion.p>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-3 text-fluid-sm text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Built on your Mac. Secret-filtered before anything is sent.
          </div>
        </div>
      </div>
    </Section>
  );
}
