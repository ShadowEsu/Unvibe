"use client";

import { motion } from "framer-motion";
import { Button } from "../Button";
import { HeroDemo } from "./HeroDemo";
import { durations, easing } from "@/lib/motion";
import { track } from "@/lib/analytics";

export function Hero() {
  return (
    <section className="container-page relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-16">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgb(var(--primary)/0.14),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgb(var(--blue)/0.10),_transparent_45%)]" />
        <div className="absolute bottom-0 left-1/2 -z-10 h-64 w-[60rem] -translate-x-1/2 bg-[radial-gradient(ellipse,_rgb(var(--primary)/0.06),_transparent_70%)]" />
      </div>

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
            <span className="mb-5 inline-flex items-center gap-2 rounded-pill border border-line bg-surface/80 px-4 py-1.5 text-fluid-sm text-fg-muted backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
              </span>
              Completely free · Mac &amp; Windows · v1.0.0
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
            Understand the code{" "}
            <span className="text-gradient-primary">AI writes</span>.
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
            Agents ship faster than people can learn. Unvibe sits beside Cursor,
            VS Code, and your terminal: select code, pick a depth, get a clear
            explanation, then prove you understood it — without leaving your
            workflow.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: durations.standard, delay: 0.2 }}
            className="mt-6 space-y-3 text-fluid-sm text-fg-muted"
          >
            {[
              {
                color: "bg-primary",
                text: "Explains selections, diffs, functions, and project structure",
              },
              {
                color: "bg-blue",
                text: "Five depths: first time through expert tradeoffs",
              },
              {
                color: "bg-green",
                text: "Free for everyone in beta. No credit card. No pricing wall.",
              },
            ].map((item, i) => (
              <motion.li
                key={item.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: durations.standard,
                  delay: 0.25 + i * 0.08,
                  ease: easing.emphatic,
                }}
                className="flex gap-3"
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.color}`}
                />
                {item.text}
              </motion.li>
            ))}
          </motion.ul>

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
              href="#download"
              size="lg"
              className="btn-magnetic"
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
