"use client";

import { motion } from "framer-motion";
import { Button } from "../Button";
import { HeroDemo } from "./HeroDemo";
import { durations, easing } from "@/lib/motion";
import { track } from "@/lib/analytics";

export function Hero() {
  return (
    <section className="container-page relative pb-12 pt-8 sm:pb-16 sm:pt-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(ellipse_at_top_left,_rgb(var(--primary)/0.12),_transparent_50%),radial-gradient(ellipse_at_top_right,_rgb(var(--blue)/0.10),_transparent_45%)]" />

      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.standard, ease: easing.emphatic }}
            className="mb-4 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1 text-fluid-sm text-fg-muted"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden="true" />
            Completely free · Mac &amp; Windows · v1.0.0
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: durations.storyFast,
              ease: easing.emphatic,
              delay: 0.04,
            }}
            className="max-w-xl text-balance text-fluid-4xl font-semibold tracking-tight text-fg"
          >
            Understand the code AI writes.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: durations.storyFast,
              ease: easing.emphatic,
              delay: 0.1,
            }}
            className="mt-4 max-w-xl text-pretty text-fluid-lg leading-relaxed text-fg-muted"
          >
            Agents ship faster than people can learn. Unvibe sits beside Cursor,
            VS Code, and your terminal: select code, pick a depth, get a clear
            explanation, then prove you understood it—without leaving your workflow.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.standard, delay: 0.16 }}
            className="mt-5 space-y-2 text-fluid-sm text-fg-muted"
          >
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Explains selections, diffs, functions, and project structure
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
              Five depths: first time through expert tradeoffs
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
              Free for everyone in beta. No credit card. No pricing wall.
            </li>
          </motion.ul>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: durations.storyFast,
              ease: easing.emphatic,
              delay: 0.2,
            }}
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <Button
              href="#download"
              size="lg"
              onClick={() => track("download_clicked", { source: "hero" })}
            >
              Download free
            </Button>
            <Button
              href="#demo"
              variant="secondary"
              size="lg"
              onClick={() => track("demo_started", { source: "hero" })}
            >
              See how it works
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: durations.story,
            ease: easing.emphatic,
            delay: 0.08,
          }}
        >
          <HeroDemo />
        </motion.div>
      </div>
    </section>
  );
}
