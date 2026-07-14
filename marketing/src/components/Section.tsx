"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp, inViewOnce, stagger } from "@/lib/motion";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Center the heading block. */
  centered?: boolean;
  /** Constrain body width to prose measure. */
  narrow?: boolean;
  as?: "section" | "div";
}

/**
 * Reusable section wrapper. Provides consistent vertical rhythm, an optional heading
 * block (eyebrow / title / subtitle) with a single scroll-triggered entrance, and a
 * landmark id for the nav's active-section tracking.
 */
export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
  centered = false,
  narrow = false,
  as = "section",
}: SectionProps) {
  const Tag = as === "section" ? motion.section : motion.div;
  const hasHeading = eyebrow || title || subtitle;

  return (
    <Tag
      id={id}
      className={cn(
        "container-page scroll-mt-24 py-20 sm:py-28",
        className
      )}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      variants={stagger}
    >
      {hasHeading && (
        <div
          className={cn(
            "mb-12 max-w-2xl",
            centered && "mx-auto text-center"
          )}
        >
          {eyebrow && (
            <motion.p
              variants={fadeUp}
              className="mb-3 text-fluid-sm font-medium uppercase tracking-[0.18em] text-primary"
            >
              {eyebrow}
            </motion.p>
          )}
          {title && (
            <motion.h2
              variants={fadeUp}
              className="text-balance text-fluid-2xl font-semibold text-fg"
            >
              {title}
            </motion.h2>
          )}
          {subtitle && (
            <motion.p
              variants={fadeUp}
              className="mt-4 text-pretty text-fluid-lg leading-relaxed text-fg-muted"
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      )}
      <div className={cn(narrow && "mx-auto max-w-prose")}>{children}</div>
    </Tag>
  );
}
