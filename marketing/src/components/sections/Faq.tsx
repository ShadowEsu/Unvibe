"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { faqItems } from "@/data/faq";

export function Faq() {
  const [open, setOpen] = useState<string | null>(faqItems[0].id);

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = prev === id ? null : id;
      if (next === id) track("faq_opened", { id });
      return next;
    });
  };

  return (
    <Section
      id="faq"
      eyebrow="FAQ"
      title="Straight answers."
      subtitle="What Unvibe does, what it does not, and how it treats your code — no hedging."
      narrow
    >
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {faqItems.map((item) => {
          const isOpen = open === item.id;
          return (
            <div key={item.id}>
              <h3>
                <button
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${item.id}`}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-2/60"
                >
                  <span className="text-fluid-base font-medium text-fg">
                    {item.question}
                  </span>
                  <Plus
                    size={18}
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 text-fg-faint transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      isOpen && "rotate-45 text-primary"
                    )}
                  />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`faq-${item.id}`}
                    role="region"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.2, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-6 text-pretty text-fluid-base leading-relaxed text-fg-muted">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
