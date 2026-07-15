"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import {
  allCategories,
  categoryLabels,
  languages,
  type LanguageCategory,
} from "@/lib/languages";

export function LanguageExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LanguageCategory | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return languages.filter((lang) => {
      const matchesCategory =
        category === "all" || lang.categories.includes(category);
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        lang.name.toLowerCase().includes(q) ||
        lang.blurb.toLowerCase().includes(q) ||
        lang.concepts.some((c) => c.toLowerCase().includes(q)) ||
        lang.frameworks.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  const open = languages.find((l) => l.id === openId) ?? null;

  return (
    <Section
      id="learn"
      eyebrow="Languages"
      title="Explain across the languages you actually touch."
      subtitle="Seventeen languages and counting, from the front end to the database. Search for one, or filter by where it lives in your stack."
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search languages, concepts, frameworks"
            aria-label="Search languages"
            className="h-11 w-full rounded-pill border border-line bg-surface pl-10 pr-4 text-fluid-sm text-fg placeholder:text-fg-faint focus:border-primary focus-visible:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
          >
            All
          </FilterChip>
          {allCategories.map((cat) => (
            <FilterChip
              key={cat}
              active={category === cat}
              onClick={() => setCategory(cat)}
            >
              {categoryLabels[cat]}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <p className="text-fluid-base text-fg">No languages match that search.</p>
          <p className="mt-1 text-fluid-sm text-fg-muted">
            Try a broader term, or clear the filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((lang) => (
            <button
              key={lang.id}
              onClick={() => setOpenId(lang.id)}
              className="group flex flex-col rounded-card border border-line bg-surface p-4 text-left transition-colors duration-micro hover:border-line-strong hover:bg-surface-2"
            >
              <span className="text-fluid-base font-semibold text-fg">
                {lang.name}
              </span>
              <span className="mt-1 line-clamp-2 text-fluid-sm text-fg-muted">
                {lang.blurb}
              </span>
              <span className="mt-3 flex flex-wrap gap-1">
                {lang.categories.map((c) => (
                  <span
                    key={c}
                    className="rounded-pill bg-surface-2 px-2 py-0.5 text-[0.62rem] uppercase tracking-wide text-fg-faint group-hover:bg-bg"
                  >
                    {categoryLabels[c]}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              aria-label="Close"
              className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
              onClick={() => setOpenId(null)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${open.name} details`}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="relative w-full max-w-lg overflow-hidden rounded-card border border-line bg-surface shadow-lift"
            >
              <div className="flex items-start justify-between border-b border-line p-5">
                <div>
                  <h3 className="text-fluid-xl font-semibold text-fg">
                    {open.name}
                  </h3>
                  <p className="mt-1 text-fluid-sm text-fg-muted">{open.blurb}</p>
                </div>
                <button
                  aria-label="Close"
                  onClick={() => setOpenId(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted hover:text-fg"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="space-y-5 p-5">
                <DetailRow label="Concepts Unvibe explains">
                  {open.concepts.map((c) => (
                    <Tag key={c}>{c}</Tag>
                  ))}
                </DetailRow>
                <DetailRow label="Recognized in context">
                  {open.frameworks.map((f) => (
                    <Tag key={f}>{f}</Tag>
                  ))}
                </DetailRow>
                <div>
                  <p className="mb-2 text-fluid-sm font-medium text-fg">
                    A learning path
                  </p>
                  <ol className="flex flex-col gap-1.5">
                    {open.learningPath.map((step, i) => (
                      <li
                        key={step}
                        className="flex items-center gap-2 text-fluid-sm text-fg-muted"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[0.66rem] text-fg-faint">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/60 p-3 font-mono text-[0.76rem] text-fg">
                  {open.sample}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-pill border px-3 py-1.5 text-fluid-sm transition-colors duration-micro",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-line text-fg-muted hover:text-fg"
      )}
    >
      {children}
    </button>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-fluid-sm font-medium text-fg">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill border border-line bg-surface px-2.5 py-1 font-mono text-[0.7rem] text-fg-muted">
      {children}
    </span>
  );
}
