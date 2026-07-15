"use client";

import { motion } from "framer-motion";
import { Eye, RefreshCw, CheckCircle2, RotateCcw } from "lucide-react";
import { Section } from "../Section";
import { fadeUp, inViewOnce } from "@/lib/motion";

const signals = [
  {
    Icon: Eye,
    title: "What you reviewed",
    body: "Every snippet you asked about, with the concepts it touched.",
  },
  {
    Icon: RefreshCw,
    title: "When you asked again",
    body: "Requesting a different explanation is a signal that it had not landed yet.",
  },
  {
    Icon: CheckCircle2,
    title: "What you got right",
    body: "Comprehension checks confirm understanding rather than assuming it.",
  },
  {
    Icon: RotateCcw,
    title: "What you revisited",
    body: "Concepts you return to surface again later, spaced for retention.",
  },
];

const concepts = [
  { name: "Closures", level: 0.86 },
  { name: "Async / await", level: 0.72 },
  { name: "SQL joins", level: 0.54 },
  { name: "React effects", level: 0.4 },
  { name: "Memory ownership", level: 0.22 },
];

export function LearningEngine() {
  return (
    <Section
      id="learning-engine"
      eyebrow="The learning engine"
      title="It notices what you understand, not just what you clicked."
      subtitle="Unvibe reads quiet signals from how you engage and turns them into a concept profile — so it can build on what stuck and gently revisit what did not."
      variant="editorial"
    >
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="grid gap-3 sm:grid-cols-2">
          {signals.map((s) => (
            <motion.div
              key={s.title}
              variants={fadeUp}
              className="rounded-card border border-line bg-surface p-5"
            >
              <s.Icon size={18} className="text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-fluid-base font-semibold text-fg">
                {s.title}
              </h3>
              <p className="mt-1 text-fluid-sm leading-relaxed text-fg-muted">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          variants={fadeUp}
          className="rounded-card border border-line bg-surface p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-fluid-base font-semibold text-fg">
              Your concept profile
            </h3>
            <span className="rounded-pill bg-surface-2 px-2.5 py-0.5 font-mono text-[0.66rem] text-fg-faint">
              illustrative
            </span>
          </div>
          <div className="space-y-4">
            {concepts.map((c, i) => (
              <div key={c.name}>
                <div className="mb-1.5 flex items-center justify-between text-fluid-sm">
                  <span className="text-fg">{c.name}</span>
                  <span className="text-fg-faint">
                    {Math.round(c.level * 100)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${c.level * 100}%` }}
                    viewport={inViewOnce}
                    transition={{
                      duration: 0.8,
                      delay: 0.1 + i * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-fluid-sm text-fg-muted">
            Sample data shown for illustration — your real profile builds from your
            own reviews and never from tracking your screen.
          </p>
        </motion.div>
      </div>
    </Section>
  );
}
