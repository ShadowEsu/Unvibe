"use client";

import { motion } from "framer-motion";
import { GraduationCap, Rocket, Compass, Briefcase } from "lucide-react";
import { Section } from "../Section";
import { fadeUp, stagger } from "@/lib/motion";

const stories = [
  {
    Icon: GraduationCap,
    who: "The CS student",
    situation:
      "Assignments lean on frameworks the lectures never covered.",
    help: "Unvibe explains the generated boilerplate in plain terms, so you can defend your own code in the viva.",
  },
  {
    Icon: Rocket,
    who: "The bootcamp grad",
    situation:
      "You can ship a feature with AI, but interviews ask how it works.",
    help: "Turn every accepted suggestion into a concept you can articulate, with quizzes that catch the gaps.",
  },
  {
    Icon: Compass,
    who: "The self-taught builder",
    situation:
      "You are vibe-coding a real product faster than you understand it.",
    help: "Keep momentum while Unvibe backfills the why, so future you can maintain what present you shipped.",
  },
  {
    Icon: Briefcase,
    who: "The career switcher",
    situation:
      "You inherited a codebase in a language you have never written.",
    help: "Read any file at your depth and build a concept profile that tracks what you have genuinely learned.",
  },
];

export function StudentStories() {
  return (
    <Section
      id="students"
      eyebrow="Who it is for"
      title="For anyone learning faster than they are understanding."
      subtitle="Not testimonials — the real situations Unvibe was built for. If one of these is you, the waitlist is open."
    >
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-10%" }}
        className="grid gap-5 sm:grid-cols-2"
      >
        {stories.map((s) => (
          <motion.div
            key={s.who}
            variants={fadeUp}
            className="card-hover flex flex-col rounded-card border border-line bg-surface p-7"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <s.Icon size={21} aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-fluid-lg font-semibold text-fg">
              {s.who}
            </h3>
            <p className="mt-2.5 text-fluid-base leading-relaxed text-fg-muted">
              {s.situation}
            </p>
            <p className="mt-4 border-t border-line pt-4 text-fluid-base leading-relaxed text-fg">
              {s.help}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
