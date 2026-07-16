"use client";

import { motion } from "framer-motion";
import { Button } from "../Button";
import { HeroDemo } from "./HeroDemo";
import { durations, easing } from "@/lib/motion";
import { track } from "@/lib/analytics";

export function Hero() {
  return (
    <section className="container-page relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: durations.standardSlow,
              ease: easing.emphatic,
            }}
          >
            <span className="mb-5 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-4 py-1.5 text-fluid-sm text-fg-muted shadow-soft">
              <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />
              Mac first · Private beta
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: durations.story,
              ease: easing.emphatic,
              delay: 0.06,
            }}
            className="max-w-xl text-balance text-fluid-4xl font-semibold tracking-tight text-fg sm:text-fluid-5xl"
          >
            Vibe code <span className="text-primary">without the guilt</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: durations.story,
              ease: easing.emphatic,
              delay: 0.12,
            }}
            className="mt-5 max-w-xl text-pretty text-fluid-lg leading-relaxed text-fg-muted"
          >
            Let AI help you move faster. Unvibe helps you understand what ships —
            in the depth you need, without leaving your workflow.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: durations.story,
              ease: easing.emphatic,
              delay: 0.3,
            }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <Button
              href="#waitlist"
              size="lg"
              className="btn-magnetic"
              onClick={() => track("waitlist_started", { source: "hero" })}
            >
              Join the private beta
            </Button>
            <Button
              href="#demo"
              variant="secondary"
              size="lg"
              onClick={() => track("demo_started", { source: "hero" })}
            >
              Watch how it works
            </Button>
          </motion.div>
          <p className="mt-5 text-fluid-sm text-fg-faint">
            Five minutes a day · Five explanation depths · No API key during private beta
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: durations.story,
            ease: easing.emphatic,
            delay: 0.1,
          }}
        >
          <HeroDemo />
        </motion.div>
      </div>
    </section>
  );
}
