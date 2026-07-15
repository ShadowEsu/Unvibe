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
  centered?: boolean;
  narrow?: boolean;
  as?: "section" | "div";
  /** Visual rhythm variant */
  variant?: "standard" | "compact" | "editorial" | "full";
  /** Surface background tint */
  surface?: "default" | "brand" | "alt" | "warm";
  /** Show divider below */
  divider?: boolean;
}

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
  variant = "standard",
  surface = "default",
  divider = false,
}: SectionProps) {
  const Tag = as === "section" ? motion.section : motion.div;
  const hasHeading = eyebrow || title || subtitle;

  const containerClass =
    variant === "full" ? "container-full" : narrow ? "container-narrow" : "container-page";

  const sectionClass = cn(
    "scroll-mt-24",
    variant === "compact" && "section-compact",
    variant === "standard" && "section-standard",
    variant === "editorial" && "section-editorial",
    variant === "full" && "section-standard",
    surface === "brand" && "surface-brand",
    surface === "alt" && "surface-alt",
    surface === "warm" && "surface-warm",
    divider && "section-divider",
    className
  );

  return (
    <Tag
      id={id}
      className={sectionClass}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      variants={stagger}
    >
      <div className={containerClass}>
        {hasHeading && (
          <div
            className={cn(
              "mb-10 max-w-2xl",
              centered && "mx-auto text-center",
              variant === "editorial" && "mb-14 max-w-3xl",
              variant === "editorial" && centered && "mx-auto text-center"
            )}
          >
            {eyebrow && (
              <motion.p
                variants={fadeUp}
                className="mb-4 text-fluid-sm font-medium uppercase tracking-[0.18em] text-primary"
              >
                {eyebrow}
              </motion.p>
            )}
            {title && (
              <motion.h2
                variants={fadeUp}
                className={cn(
                  "text-balance font-semibold text-fg",
                  variant === "editorial"
                    ? "font-display text-fluid-3xl font-book tracking-tight"
                    : "text-fluid-2xl"
                )}
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
        {children}
      </div>
    </Tag>
  );
}
