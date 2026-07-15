"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Braces,
  FileCode2,
  GitBranch,
  Link2,
} from "lucide-react";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import { durations, easing } from "@/lib/motion";

const levels = [
  {
    id: "line",
    short: "Line",
    label: "Selected line",
    Icon: Braces,
    eyebrow: "What this expression does",
    insight: "Returns the cached cart immediately when one already exists, avoiding another database read.",
    detail: "The early return ends this function before the database query below can run.",
  },
  {
    id: "function",
    short: "Function",
    label: "Function flow",
    Icon: ArrowRight,
    eyebrow: "How data enters and leaves",
    insight: "A user ID becomes a cache key; the function returns cached JSON or fetches, stores, and returns a fresh cart.",
    detail: "Input → cache lookup → database fallback → sixty-second cache → cart response.",
  },
  {
    id: "file",
    short: "File",
    label: "File role",
    Icon: FileCode2,
    eyebrow: "What this module owns",
    insight: "cart.ts is the boundary between route handlers, the cart database model, and short-lived Redis caching.",
    detail: "It centralizes cart reads so callers do not implement their own cache rules.",
  },
  {
    id: "dependency",
    short: "Dependency",
    label: "Dependency",
    Icon: Link2,
    eyebrow: "What external behavior it relies on",
    insight: "Redis must preserve key isolation and expiry semantics; the database remains the source of truth.",
    detail: "If Redis is unavailable, this path needs a safe database fallback instead of failing the request.",
  },
  {
    id: "change",
    short: "Change",
    label: "Git change",
    Icon: GitBranch,
    eyebrow: "Why the agent modified it",
    insight: "The change reduces repeated cart reads during checkout without making cached data permanent.",
    detail: "The important review question is whether cart mutations invalidate this cache early enough.",
  },
  {
    id: "project",
    short: "Project",
    label: "Project map",
    Icon: Boxes,
    eyebrow: "Where this fits in the architecture",
    insight: "Checkout routes call the cart service, which coordinates Redis and Postgres before returning domain data.",
    detail: "The cache is an optimization around the service layer—not a new source of truth.",
  },
  {
    id: "learning",
    short: "Learn",
    label: "Concept to learn",
    Icon: BookOpen,
    eyebrow: "What to understand next",
    insight: "Cache invalidation: keeping fast reads consistent after a cart item is added, removed, or updated.",
    detail: "Save this concept, review it in this project, then test it with one short scenario.",
  },
] as const;

const code = [
  "export async function getCart(userId: string) {",
  "  const key = `cart:${userId}`;",
  "  const cached = await redis.get(key);",
  "  if (cached) return JSON.parse(cached);",
  "  const cart = await db.cart.find(userId);",
  "  await redis.set(key, JSON.stringify(cart), 'EX', 60);",
  "  return cart;",
  "}",
];

export function ContextStory() {
  const [active, setActive] = useState(0);
  const level = levels[active];

  return (
    <Section
      id="context"
      eyebrow="Unvibe follows the context"
      title="Start with one line. Leave with the whole reason it exists."
      subtitle="Move from the selected expression to the function, file, dependency, change, project, and concept worth learning next. Each step answers one useful question."
    >
      <div className="overflow-hidden rounded-[1.4rem] border border-line bg-surface shadow-lift">
        <div
          role="tablist"
          aria-label="Code context level"
          className="flex gap-1 overflow-x-auto border-b border-line bg-surface-2/55 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-3"
        >
          {levels.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-controls="context-story-panel"
              onClick={() => setActive(index)}
              className={cn(
                "relative flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-fluid-sm font-medium transition-colors duration-micro sm:flex-1 sm:justify-center sm:px-2",
                active === index ? "text-on-primary" : "text-fg-muted hover:bg-surface hover:text-fg"
              )}
            >
              {active === index && (
                <motion.span
                  layoutId="context-level"
                  className="absolute inset-0 -z-0 rounded-xl bg-primary"
                  transition={{ duration: durations.standard, ease: easing.emphatic }}
                />
              )}
              <item.Icon className="relative z-10 h-4 w-4" aria-hidden="true" />
              <span className="relative z-10 sm:hidden lg:inline">{item.short}</span>
            </button>
          ))}
        </div>

        <div id="context-story-panel" role="tabpanel" className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="border-b border-line bg-[#11131a] p-4 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center justify-between text-[0.72rem] text-white/45">
              <span className="font-mono">src/services/cart.ts</span>
              <span>{level.label}</span>
            </div>
            <div className="overflow-x-auto font-mono text-[0.73rem] leading-[2] text-white/62 sm:text-[0.82rem]">
              {code.map((line, index) => (
                <div
                  key={line}
                  className={cn(
                    "-mx-2 flex min-w-max gap-4 rounded-md px-2 transition-colors duration-standard",
                    active === 0 && index === 3 && "bg-primary/35 text-white",
                    active === 1 && index > 0 && index < 7 && "bg-primary/12 text-white/90",
                    active >= 2 && "text-white/72"
                  )}
                >
                  <span className="w-4 select-none text-right text-white/24">{index + 1}</span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 overflow-hidden text-[0.68rem] text-white/45 sm:text-[0.72rem]">
              {levels.slice(0, active + 1).map((item, index) => (
                <span key={item.id} className="flex shrink-0 items-center gap-2">
                  {index > 0 && <ArrowRight className="h-3 w-3" aria-hidden="true" />}
                  <span className={cn(index === active && "text-white")}>{item.short}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex min-h-[22rem] flex-col p-6 sm:p-9">
            <AnimatePresence mode="wait">
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: durations.standard, ease: easing.calm }}
                className="flex flex-1 flex-col"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <level.Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-7 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-primary">
                  {level.eyebrow}
                </p>
                <h3 className="mt-3 text-balance text-fluid-xl font-semibold leading-tight text-fg">
                  {level.insight}
                </h3>
                <p className="mt-4 max-w-lg text-fluid-base leading-relaxed text-fg-muted">
                  {level.detail}
                </p>
                <p className="mt-auto pt-8 text-fluid-sm text-fg-faint">
                  {active + 1} of {levels.length} · Choose any context level
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Section>
  );
}

