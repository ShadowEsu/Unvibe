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
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance text-fluid-3xl font-semibold tracking-tight text-fg">
            Ship with AI. Learn what you shipped.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-fluid-lg leading-relaxed text-fg-muted">
            Join the private beta for a quieter way to understand the code you
            ship. No API key or model account required — Unvibe covers it during beta.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Button href="#waitlist" size="lg" className="btn-magnetic">
              Join the private beta
            </Button>
            <Button href="#demo" variant="secondary" size="lg">
              Watch the demo
            </Button>
          </div>
          <p className="mt-6 text-fluid-sm text-fg-faint">
            Mac first · Invitation-only beta · Free during beta · Privacy built in
          </p>
        </div>
      </motion.div>
    </section>
  );
}
