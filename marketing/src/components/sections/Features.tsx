"use client";

import { motion } from "framer-motion";
import {
  MessagesSquare,
  Quote,
  Layers,
  Repeat,
  FileText,
  Radio,
  ShieldQuestion,
} from "lucide-react";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import { fadeUp, inViewOnce, stagger } from "@/lib/motion";

interface Feature {
  Icon: typeof Quote;
  title: string;
  body: string;
  badge?: string;
  points: string[];
}

const features: Feature[] = [
  {
    Icon: Quote,
    title: "Explanations that cite the code",
    body: "Every claim points back to the exact lines it describes, so you can check the explanation against reality instead of trusting it blindly.",
    points: ["File and line citations", "Reads only what you select", "Validated against context"],
  },
  {
    Icon: MessagesSquare,
    title: "Ask a follow-up, keep the thread",
    body: "Something still unclear? Ask in the same widget. Unvibe answers in the context of the snippet you are looking at, not a blank chat.",
    points: ["Contextual follow-ups", "No lost context", "Explain differently on demand"],
  },
  {
    Icon: Layers,
    title: "Five depths, one control",
    body: "Slide from New to Expert and the explanation re-pitches itself — plain analogy at one end, edge cases and trade-offs at the other.",
    points: ["New · Beginner · Intermediate", "Advanced · Expert", "Grows with you"],
  },
  {
    Icon: Repeat,
    title: "Comprehension you can feel",
    body: "A short check after the explanation turns passive reading into something that sticks, and quietly records what landed.",
    points: ["One focused question", "Immediate feedback", "Feeds your concept profile"],
  },
  {
    Icon: FileText,
    title: "A notebook that remembers",
    body: "Saved explanations, the concepts they touched, and the projects they came from — a personal reference that grows as you work.",
    points: ["Saved explanations", "Concept library", "Per-project history"],
  },
  {
    Icon: Radio,
    title: "Streams in, stays calm",
    body: "Answers arrive token by token in a quiet, black-and-white surface designed to inform without interrupting your flow.",
    points: ["Token-by-token streaming", "Respects light and dark", "No noise, no glow"],
  },
  {
    Icon: ShieldQuestion,
    title: "Security observations",
    body: "When an explanation touches something risky, Unvibe can flag it for a closer look. These are informational prompts, not an audit — and this area is still being built.",
    badge: "In development",
    points: ["Informational only", "Not a security audit", "No certifications claimed"],
  },
];

export function Features() {
  return (
    <Section
      eyebrow="What you get"
      title="Built to teach, not to impress."
      subtitle="Seven capabilities that turn a diff you accepted into knowledge you keep."
    >
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        className="flex flex-col gap-20 sm:gap-28"
      >
        {features.map((f, i) => {
          const reversed = i % 2 === 1;
          return (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className={cn(
                "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
                reversed && "lg:[&>*:first-child]:order-2"
              )}
            >
              <div>
                <span className="flex h-13 w-13 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <f.Icon size={24} aria-hidden="true" />
                </span>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <h3 className="text-fluid-xl font-semibold text-fg">
                    {f.title}
                  </h3>
                  {f.badge && (
                    <span className="rounded-pill border border-orange/40 bg-orange/10 px-2.5 py-0.5 text-[0.66rem] font-medium uppercase tracking-wide text-orange">
                      {f.badge}
                    </span>
                  )}
                </div>
                <p className="mt-3 max-w-md text-pretty text-fluid-base leading-relaxed text-fg-muted">
                  {f.body}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {f.points.map((p) => (
                    <li
                      key={p}
                      className="rounded-pill border border-line bg-surface px-3 py-1.5 text-fluid-sm text-fg-muted"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              <FeatureVisual index={i} feature={f} />
            </motion.div>
          );
        })}
      </motion.div>
    </Section>
  );
}

function FeatureVisual({ index, feature }: { index: number; feature: Feature }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={inViewOnce}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="card-hover relative aspect-[4/3] overflow-hidden rounded-card border border-line bg-surface p-7"
    >
      <div className="absolute inset-0 grain opacity-30" aria-hidden="true" />
      <div className="relative flex h-full flex-col justify-center gap-4">
        <feature.Icon
          size={28}
          className="text-primary/60"
          aria-hidden="true"
        />
        {[0.9, 0.7, 0.82, 0.55].map((w, i) => (
          <div
            key={i}
            className="h-3 rounded-full bg-surface-2"
            style={{ width: `${w * 100}%` }}
          />
        ))}
        <div className="mt-3 flex gap-2">
          {feature.points.slice(0, 2).map((p) => (
            <span
              key={p}
              className="truncate rounded-pill bg-primary-soft px-3 py-1 font-mono text-[0.64rem] text-primary"
            >
              {p}
            </span>
          ))}
        </div>
        <span className="absolute right-0 top-0 font-mono text-[0.68rem] text-fg-faint">
          0{index + 1}
        </span>
      </div>
    </motion.div>
  );
}
