"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, EyeOff, Check, Ban, ArrowUpRight } from "lucide-react";
import { Section } from "../Section";
import { fadeUp, stagger } from "@/lib/motion";
import { track } from "@/lib/analytics";

const guarantees = [
  {
    Icon: EyeOff,
    title: "Secrets filtered on your Mac",
    body: "API keys, tokens, and private keys are detected before anything is sent, and a hit blocks the request.",
  },
  {
    Icon: ShieldCheck,
    title: "You choose what to review",
    body: "Unvibe starts from the selection you ask it to explain. It does not record your screen or read code in the background.",
  },
  {
    Icon: Ban,
    title: "No repository upload",
    body: "The product sends review context, not an entire repository. Read the policy for the exact current limits and controls.",
  },
];

const included = ["Your selected snippet", "The scope you approved", "Shallow project structure"];
const blocked = [".env and .env.*", "*.pem · *.key · id_rsa", "node_modules / build output", "High-entropy secrets"];

export function Privacy() {
  return (
    <Section
      id="privacy"
      eyebrow="Privacy"
      title="Your code remains under your control."
      subtitle="You decide what to review. Before a request leaves your Mac, Unvibe scans the selection for common secrets."
    >
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="grid gap-4"
        >
          {guarantees.map((g) => (
            <motion.div
              key={g.title}
              variants={fadeUp}
              className="card-hover flex gap-4 rounded-card border border-line bg-surface p-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <g.Icon size={21} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-fluid-base font-semibold text-fg">
                  {g.title}
                </h3>
                <p className="mt-1.5 text-fluid-sm leading-relaxed text-fg-muted">
                  {g.body}
                </p>
              </div>
            </motion.div>
          ))}

          <div className="flex flex-wrap gap-4 pt-1">
            <Link
              href="/privacy"
              onClick={() => track("privacy_opened", { target: "privacy" })}
              className="hover-underline inline-flex items-center gap-1 text-fluid-sm font-medium text-primary"
            >
              Read the privacy policy
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/data-controls"
              onClick={() => track("privacy_opened", { target: "data-controls" })}
              className="hover-underline inline-flex items-center gap-1 text-fluid-sm font-medium text-primary"
            >
              Data controls
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </motion.div>

        {/* Transmission preview visual */}
        <motion.div
          variants={fadeUp}
          className="overflow-hidden rounded-card border border-line bg-surface"
        >
          <div className="flex items-center justify-between border-b border-line bg-surface-2/70 px-5 py-3.5">
            <span className="text-fluid-sm font-medium text-fg">
              What Unvibe reviews
            </span>
            <span className="font-mono text-[0.68rem] text-fg-faint">
              selection-first
            </span>
          </div>
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="border-b border-line p-5 sm:border-b-0 sm:border-r">
              <p className="mb-3 flex items-center gap-2 text-fluid-sm font-medium text-green">
                <Check size={15} aria-hidden="true" /> Sent
              </p>
              <ul className="space-y-2">
                {included.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg bg-green/8 px-3 py-2 font-mono text-[0.76rem] text-fg"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-5">
              <p className="mb-3 flex items-center gap-2 text-fluid-sm font-medium text-red">
                <Ban size={15} aria-hidden="true" /> Blocked
              </p>
              <ul className="space-y-2">
                {blocked.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg bg-red/8 px-3 py-2 font-mono text-[0.76rem] text-fg-muted line-through decoration-red/50"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="border-t border-line px-5 py-3.5 text-fluid-sm text-fg-muted">
            Exact behavior and current limitations are documented in the privacy policy.
          </p>
        </motion.div>
      </div>
    </Section>
  );
}
