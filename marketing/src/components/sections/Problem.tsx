"use client";

import { motion } from "framer-motion";
import { ArrowRight, GitCommitVertical } from "lucide-react";
import { Section } from "../Section";
import { CodeCard } from "../CodeCard";
import { fadeUp, inViewOnce, stagger } from "@/lib/motion";

const DIFF = `export async function getCart(userId: string) {
  const key = \`cart:\${userId}\`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  const cart = await db.cart.find(userId);
  await redis.set(key, JSON.stringify(cart), "EX", 60);
  return cart;
}`;

const annotations = [
  {
    line: "cart:${userId}",
    note: "Namespaced cache key so each user's cart is stored separately.",
  },
  {
    line: "if (cached) return ...",
    note: "Cache hit: skips the database entirely and returns early.",
  },
  {
    line: '"EX", 60',
    note: "The cache expires after 60 seconds, so stale carts self-correct.",
  },
];

export function Problem() {
  return (
    <Section
      id="product"
      eyebrow="The gap"
      title="Shipping code is not the same as understanding it."
      subtitle="AI closes tickets fast. But merged code you cannot explain becomes tomorrow's mystery bug. Unvibe turns the diff you accepted into something you actually know."
    >
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <motion.div variants={fadeUp} className="flex flex-col">
          <div className="mb-4 flex items-center gap-2 text-fluid-sm text-fg-muted">
            <GitCommitVertical size={16} className="text-fg-faint" aria-hidden="true" />
            Your agent wrote this and you merged it
          </div>
          <CodeCard
            code={DIFF}
            filename="cart.ts"
            addedLines={[2, 3, 4, 6]}
            className="flex-1"
          />
        </motion.div>

        <motion.div variants={fadeUp} className="flex flex-col">
          <div className="mb-4 flex items-center gap-2 text-fluid-sm text-fg-muted">
            <ArrowRight size={16} className="text-primary" aria-hidden="true" />
            What Unvibe helps you actually understand
          </div>
          <div className="flex-1 rounded-card border border-line bg-surface p-6">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={inViewOnce}
              className="space-y-4"
            >
              {annotations.map((a) => (
                <motion.div
                  key={a.line}
                  variants={fadeUp}
                  className="flex gap-3"
                >
                  <code className="mt-0.5 shrink-0 rounded-lg bg-primary-soft px-2.5 py-1 font-mono text-[0.72rem] text-primary">
                    {a.line}
                  </code>
                  <p className="text-fluid-sm leading-relaxed text-fg-muted">
                    {a.note}
                  </p>
                </motion.div>
              ))}
            </motion.div>
            <div className="mt-5 border-t border-line pt-4 text-fluid-sm leading-relaxed text-fg">
              It caches each user&apos;s cart for a minute to spare the database,
              and refreshes automatically when the cache expires.
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
