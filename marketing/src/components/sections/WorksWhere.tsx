"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import { durations, easing } from "@/lib/motion";

interface Surface {
  id: string;
  label: string;
  context: string;
  detail: string;
  sample: string;
}

const surfaces: Surface[] = [
  {
    id: "cursor",
    label: "Cursor",
    context: "After an agent edit",
    detail:
      "Your agent just rewrote a function. Select the diff and Unvibe explains what actually changed, so accepting a suggestion is a decision, not a leap of faith.",
    sample: "// agent applied 6 changes\nawait queue.drain({ concurrency: 4 });",
  },
  {
    id: "vscode",
    label: "VS Code",
    context: "In your editor",
    detail:
      "Highlight anything in an open file. The explanation appears in a floating widget beside your work — no context switch, no new tab.",
    sample: "const memo = useMemo(() => build(data), [data]);",
  },
  {
    id: "github",
    label: "GitHub",
    context: "Reviewing a PR (planned)",
    detail:
      "Reading an unfamiliar pull request in the browser. Copy the hunk that confuses you and get a plain explanation of the intent behind it.",
    sample: "- for (const x of xs) acc.push(f(x));\n+ const acc = xs.map(f);",
  },
  {
    id: "claude-code",
    label: "Claude Code",
    context: "In the terminal agent",
    detail:
      "A terminal agent generated a shell pipeline or a migration. Select the output and understand each step before you run it.",
    sample: "psql -c 'ALTER TABLE users ADD COLUMN plan text;'",
  },
  {
    id: "terminal",
    label: "Terminal",
    context: "At the command line",
    detail:
      "That one-liner you pasted from a forum. Unvibe breaks down flags and side effects so you know what it does before you press enter.",
    sample: "tar -czf backup.tgz --exclude=node_modules .",
  },
];

export function WorksWhere() {
  const [active, setActive] = useState(surfaces[0].id);
  const current = surfaces.find((s) => s.id === active) ?? surfaces[0];

  return (
    <Section
      id="works-where"
      eyebrow="Works where you do"
      title="One companion, every place code shows up."
      subtitle="Because Unvibe reads what you select on your Mac, it meets you in the tools you already use instead of trapping you in one editor."
    >
      <div
        role="tablist"
        aria-label="Where Unvibe works"
        className="mb-7 flex flex-wrap gap-2"
      >
        {surfaces.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={isActive}
              id={`tab-${s.id}`}
              aria-controls={`panel-${s.id}`}
              onClick={() => setActive(s.id)}
              className={cn(
                "relative rounded-pill px-5 py-2.5 text-fluid-sm font-medium transition-colors duration-micro",
                isActive ? "text-on-primary" : "text-fg-muted hover:text-fg"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="works-where-pill"
                  className="absolute inset-0 -z-10 rounded-pill bg-primary"
                  transition={{ duration: durations.standard, ease: easing.emphatic }}
                />
              )}
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-card border border-line bg-surface p-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            role="tabpanel"
            id={`panel-${current.id}`}
            aria-labelledby={`tab-${current.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: durations.standard, ease: easing.calm }}
            className="grid gap-6 p-6 sm:grid-cols-2 sm:items-center sm:p-8"
          >
            <div>
              <p className="text-fluid-sm font-medium text-primary">
                {current.context}
              </p>
              <p className="mt-3 text-pretty text-fluid-lg leading-relaxed text-fg">
                {current.detail}
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-surface-2/60 p-5 font-mono text-[0.8rem] leading-relaxed text-fg-muted">
              {current.sample.split("\n").map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "-mx-2 whitespace-pre-wrap rounded-lg px-2",
                    line.startsWith("+") && "bg-green/10 text-green",
                    line.startsWith("-") && "bg-red/10 text-red"
                  )}
                >
                  {line}
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </Section>
  );
}
