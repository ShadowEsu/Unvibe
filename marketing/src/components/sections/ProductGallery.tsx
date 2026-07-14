"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, Sun, Moon } from "lucide-react";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import { useTheme } from "../providers/ThemeProvider";

type Variant = "light" | "dark";

interface Shot {
  id: string;
  label: string;
  caption: string;
  /** When true, render the HTML mock instead of an image. */
  mock?: boolean;
}

const shots: Shot[] = [
  {
    id: "overlay",
    label: "Explanation overlay",
    caption: "A floating widget that streams the explanation beside your work.",
    mock: true,
  },
  { id: "progress", label: "Progress", caption: "See what you have understood over time." },
  { id: "projects", label: "Projects", caption: "Every codebase you have learned from." },
  { id: "study", label: "Study", caption: "Curricula built from your real projects." },
  { id: "notebook", label: "Notebook", caption: "Saved explanations you can return to." },
  { id: "library", label: "Library", caption: "Concepts collected as you go." },
  { id: "settings", label: "Settings", caption: "Consent, exclusions, and privacy controls." },
  { id: "profile", label: "Profile", caption: "Your learning identity in one place." },
  { id: "help", label: "Help", caption: "Guidance without leaving the app." },
];

export function ProductGallery() {
  const { resolved } = useTheme();
  const [variant, setVariant] = useState<Variant>("light");
  const [zoom, setZoom] = useState<Shot | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVariant(resolved);
  }, [resolved]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  // Close zoom on Escape.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  return (
    <Section
      eyebrow="The companion app"
      title="A calm home for everything you have learned."
      subtitle="Beyond the overlay, a Mac companion keeps your progress, notebook, and concept library in one calm place."
    >
      <div className="mb-5 flex items-center justify-between">
        <div
          role="radiogroup"
          aria-label="Preview theme"
          className="inline-flex items-center gap-0.5 rounded-pill border border-line bg-surface p-0.5"
        >
          <button
            role="radio"
            aria-checked={variant === "light"}
            aria-label="Light screenshots"
            onClick={() => setVariant("light")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-pill px-3 text-fluid-sm transition-colors",
              variant === "light" ? "bg-primary-soft text-primary" : "text-fg-faint"
            )}
          >
            <Sun size={14} aria-hidden="true" /> Light
          </button>
          <button
            role="radio"
            aria-checked={variant === "dark"}
            aria-label="Dark screenshots"
            onClick={() => setVariant("dark")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-pill px-3 text-fluid-sm transition-colors",
              variant === "dark" ? "bg-primary-soft text-primary" : "text-fg-faint"
            )}
          >
            <Moon size={14} aria-hidden="true" /> Dark
          </button>
        </div>

        <div className="hidden gap-2 sm:flex">
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Previous screenshots"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-fg-muted hover:text-fg"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="More screenshots"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-fg-muted hover:text-fg"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="mask-fade-x flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shots.map((shot) => (
          <figure
            key={shot.id}
            className="w-[85%] shrink-0 snap-start sm:w-[46%] lg:w-[38%]"
          >
            <button
              onClick={() => setZoom(shot)}
              className="group relative block w-full overflow-hidden rounded-card border border-line bg-surface"
              aria-label={`Zoom ${shot.label}`}
            >
              <div className="relative aspect-[16/10] w-full">
                {shot.mock ? (
                  <OverlayMock variant={variant} />
                ) : (
                  <Image
                    src={`/unvibe/${shot.id}-${variant}.webp`}
                    alt={`Unvibe ${shot.label} screen`}
                    fill
                    sizes="(max-width: 640px) 85vw, (max-width: 1024px) 46vw, 38vw"
                    className="object-cover object-top"
                  />
                )}
                <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-bg/80 text-fg opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  <ZoomIn size={15} aria-hidden="true" />
                </span>
              </div>
            </button>
            <figcaption className="mt-3">
              <span className="text-fluid-base font-medium text-fg">
                {shot.label}
              </span>
              <span className="mt-0.5 block text-fluid-sm text-fg-muted">
                {shot.caption}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <AnimatePresence>
        {zoom && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              aria-label="Close preview"
              className="absolute inset-0 bg-fg/40 backdrop-blur-sm"
              onClick={() => setZoom(null)}
            />
            <motion.figure
              role="dialog"
              aria-modal="true"
              aria-label={`${zoom.label} preview`}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-4xl overflow-hidden rounded-card border border-line bg-surface shadow-lift"
            >
              <div className="relative aspect-[16/10] w-full">
                {zoom.mock ? (
                  <OverlayMock variant={variant} />
                ) : (
                  <Image
                    src={`/unvibe/${zoom.id}-${variant}.webp`}
                    alt={`Unvibe ${zoom.label} screen`}
                    fill
                    sizes="90vw"
                    className="object-contain"
                  />
                )}
              </div>
              <figcaption className="flex items-center justify-between border-t border-line px-5 py-3">
                <span className="text-fluid-base font-medium text-fg">
                  {zoom.label}
                </span>
                <button
                  aria-label="Close preview"
                  onClick={() => setZoom(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted hover:text-fg"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

// HTML mock standing in for the floating explanation overlay (no screenshot exists).
function OverlayMock({ variant }: { variant: Variant }) {
  const dark = variant === "dark";
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center p-5",
        dark ? "bg-[#0c0b12]" : "bg-[#f4f3f8]"
      )}
    >
      <div
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-xl border shadow-soft",
          dark ? "border-white/10 bg-[#14121c]" : "border-black/10 bg-white"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 border-b px-3 py-2",
            dark ? "border-white/10" : "border-black/10"
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#6b5ce7]" aria-hidden="true" />
          <span
            className={cn(
              "font-mono text-[0.62rem]",
              dark ? "text-white/60" : "text-black/50"
            )}
          >
            debounce · intermediate
          </span>
        </div>
        <div className="space-y-2 p-3">
          {[0.95, 0.8, 0.88, 0.6].map((w, i) => (
            <div
              key={i}
              className={cn("h-2 rounded-full", dark ? "bg-white/12" : "bg-black/8")}
              style={{ width: `${w * 100}%` }}
            />
          ))}
          <div className="flex gap-1.5 pt-1">
            {["closures", "timers"].map((t) => (
              <span
                key={t}
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[0.6rem]",
                  dark ? "bg-white/10 text-white/70" : "bg-black/5 text-black/60"
                )}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
