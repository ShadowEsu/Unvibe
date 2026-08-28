"use client";

import { motion } from "framer-motion";
import { ArrowRight, GitCommitVertical, AlertTriangle } from "lucide-react";
import { CodeCard } from "../CodeCard";

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
    <section className="container-page section-editorial" id="product">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-4 text-fluid-sm font-medium uppercase tracking-[0.18em] text-primary">
          The gap
        </p>
        <h2 className="text-balance font-display text-fluid-3xl font-book leading-[1.08] tracking-tight text-fg">
          You shipped it.
          <br />
          <span className="text-primary">Can you explain it?</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-fluid-lg leading-relaxed text-fg-muted">
          AI closes tickets fast. But merged code you cannot explain
          becomes tomorrow&apos;s mystery bug. Unvibe turns the diff
          you accepted into something you actually know.
        </p>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col"
        >
          <div className="mb-3 flex items-center gap-2 text-fluid-sm text-fg-muted">
            <GitCommitVertical size={16} className="text-fg-faint" aria-hidden="true" />
            Your agent wrote this. You merged it.
          </div>
          <div className="relative flex-1">
            <div className="pointer-events-none absolute -left-3 top-0 h-full w-0.5 bg-red/40" aria-hidden="true" />
            <CodeCard
              code={DIFF}
              filename="cart.ts"
              addedLines={[2, 3, 4, 6]}
              className="flex-1"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col"
        >
          <div className="mb-3 flex items-center gap-2 text-fluid-sm text-fg-muted">
            <ArrowRight size={16} className="text-primary" aria-hidden="true" />
            Unvibe shows you what it actually does
          </div>
          <div className="flex-1 space-y-3 rounded-card border border-line bg-surface p-5 shadow-soft">
            {annotations.map((a, i) => (
              <motion.div
                key={a.line}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.4 }}
                className="flex gap-3"
              >
                <code className="mt-0.5 shrink-0 rounded bg-primary-soft px-2 py-1 font-mono text-[0.7rem] text-primary">
                  {a.line}
                </code>
                <p className="text-fluid-sm leading-relaxed text-fg-muted">
                  {a.note}
                </p>
              </motion.div>
            ))}
            <div className="!mt-5 flex items-start gap-3 rounded-xl border border-orange/20 bg-orange/5 p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
              <p className="text-fluid-sm leading-relaxed text-fg-muted">
                It caches each user&apos;s cart for sixty seconds to spare the database,
                and refreshes when the cache expires. <strong className="text-fg">Would you have caught that without the explanation?</strong>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
