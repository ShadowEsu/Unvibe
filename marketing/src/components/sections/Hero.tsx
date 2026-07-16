"use client";

import { motion } from "framer-motion";
import { Button } from "../Button";
import { HeroDemo } from "./HeroDemo";
import { durations, easing } from "@/lib/motion";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-12 pt-6 sm:pb-20 sm:pt-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgb(var(--primary)/0.10),transparent_60%),radial-gradient(ellipse_40%_30%_at_80%_80%,rgb(var(--blue)/0.06),transparent_50%)]" />

      <div className="container-page">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.95fr] lg:gap-14">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: durations.standard, ease: easing.emphatic }}
              className="mb-5 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1 text-fluid-sm text-fg-muted shadow-soft"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" />
              Free Mac private beta
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: durations.storyFast,
                ease: easing.emphatic,
                delay: 0.04,
              }}
              className="max-w-2xl text-balance font-display text-fluid-4xl font-book leading-[1.06] tracking-tight text-fg"
            >
              Understand the code
              <br />
              <span className="text-primary">AI writes.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: durations.storyFast,
                ease: easing.emphatic,
                delay: 0.1,
              }}
              className="mt-5 max-w-xl text-pretty text-fluid-lg leading-relaxed text-fg-muted"
            >
              Your agent ships code faster than you can learn it.
              Unvibe lives beside Cursor, VS Code, and your terminal:
              select any code, choose your depth, and understand what
              shipped — without leaving your workflow.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: durations.storyFast,
                ease: easing.emphatic,
                delay: 0.18,
              }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button href="#waitlist" size="lg">
                Join the free beta
              </Button>
              <Button href="#demo" variant="secondary" size="lg">
                Watch the demo
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: durations.standard }}
              className="mt-4 text-fluid-sm text-fg-faint"
            >
              Mac first &middot; No credit card &middot; No charge during private beta
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: durations.story,
              ease: easing.emphatic,
              delay: 0.08,
            }}
            className="relative"
          >
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_center,rgb(var(--primary)/0.08),transparent_70%)]" />
            <HeroDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
