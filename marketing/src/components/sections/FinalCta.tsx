"use client";

import { motion } from "framer-motion";
import { Button } from "../Button";
import { durations, easing } from "@/lib/motion";

export function FinalCta() {
  return (
    <section className="container-page py-20 sm:py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: durations.story, ease: easing.emphatic }}
        className="relative overflow-hidden rounded-card border border-line bg-surface px-8 py-16 text-center sm:px-16 sm:py-20"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(var(--primary)/0.14),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgb(var(--blue)/0.10),_transparent_50%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance text-fluid-3xl font-semibold tracking-tight text-fg">
            Ship with AI. Learn what you shipped.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-fluid-lg leading-relaxed text-fg-muted">
            Download Unvibe free for Mac and Windows, or join the waitlist for
            updates as we ship the next releases.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Button href="#download" size="lg" className="btn-magnetic">
              Download free
            </Button>
            <Button href="#waitlist" variant="secondary" size="lg">
              Join waitlist
            </Button>
          </div>
          <p className="mt-6 text-fluid-sm text-fg-faint">
            Completely free · Mac + Windows · No credit card · No pricing wall
          </p>
        </div>
      </motion.div>
    </section>
  );
}
