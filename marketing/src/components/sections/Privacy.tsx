"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, EyeOff, Check, Ban, ArrowUpRight } from "lucide-react";
import { Section } from "../Section";
import { fadeUp } from "@/lib/motion";
import { track } from "@/lib/analytics";

const guarantees = [
  {
    Icon: EyeOff,
    title: "Secrets filtered on your Mac",
    body: "API keys, tokens, and private keys are detected before anything is sent, and a hit blocks the request.",
  },
  {
    Icon: ShieldCheck,
    title: "You preview what leaves",
    body: "See exactly what would be transmitted, and grant cloud analysis per repository. It is off until you say so.",
  },
  {
    Icon: Ban,
    title: "Never trained on your code",
    body: "We use a provider setting that does not train on submitted data, and analytics never contain code contents.",
  },
];

const included = ["Your selected snippet", "The scope you approved", "Shallow project structure"];
const blocked = [".env and .env.*", "*.pem · *.key · id_rsa", "node_modules / build output", "High-entropy secrets"];

export function Privacy() {
  return (
    <Section
      id="privacy"
      eyebrow="Privacy"
      title="Your code stays yours. By design, not by promise."
      subtitle="Unvibe builds context locally and filters secrets before any request. The whole repository is never uploaded, and cloud analysis is consent-gated per repo."
      variant="editorial"
      surface="brand"
    >
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="grid gap-3">
          {guarantees.map((g) => (
            <motion.div
              key={g.title}
              variants={fadeUp}
              className="flex gap-4 rounded-card border border-line bg-surface p-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <g.Icon size={20} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-fluid-base font-semibold text-fg">
                  {g.title}
                </h3>
                <p className="mt-1 text-fluid-sm leading-relaxed text-fg-muted">
                  {g.body}
                </p>
              </div>
            </motion.div>
          ))}

          <div className="flex flex-wrap gap-4 pt-1">
            <Link
              href="/privacy"
              onClick={() => track("privacy_opened", { target: "privacy" })}
              className="inline-flex items-center gap-1 text-fluid-sm font-medium text-primary hover:underline"
            >
              Read the privacy policy
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/data-controls"
              onClick={() => track("privacy_opened", { target: "data-controls" })}
              className="inline-flex items-center gap-1 text-fluid-sm font-medium text-primary hover:underline"
            >
              Data controls
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Transmission preview visual */}
        <motion.div
          variants={fadeUp}
          className="overflow-hidden rounded-card border border-line bg-surface"
        >
          <div className="flex items-center justify-between border-b border-line bg-surface-2/70 px-5 py-3">
            <span className="text-fluid-sm font-medium text-fg">
              Transmission preview
            </span>
            <span className="font-mono text-[0.66rem] text-fg-faint">
              before any request
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
                    className="rounded-lg bg-green/8 px-3 py-2 font-mono text-[0.74rem] text-fg"
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
                    className="rounded-lg bg-red/8 px-3 py-2 font-mono text-[0.74rem] text-fg-muted line-through decoration-red/50"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="border-t border-line px-5 py-3 text-fluid-sm text-fg-muted">
            Add your own rules with a <code className="font-mono text-primary">.unvibeignore</code> file.
          </p>
        </motion.div>
      </div>
    </Section>
  );
}
