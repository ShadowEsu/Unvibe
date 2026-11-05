"use client";

import { useId, useState, type ReactNode } from "react";

export interface ExpandRow {
  id: string;
  question: string;
  answer: ReactNode;
}

/**
 * Rows that open and close (Design N): a button with aria-expanded and the region it controls. The answer is
 * always in the HTML, so search engines and the FAQ JSON-LD see the same words; while closed it is inert and
 * hidden from assistive tech, matching aria-expanded. The height opens with grid-template-rows 0fr -> 1fr and the
 * + turns 45 degrees (n.css); reduced motion opens it at once.
 */
export function ExpandRows({ rows, openFirst = false }: { rows: readonly ExpandRow[]; openFirst?: boolean }) {
  const base = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(openFirst && rows[0] ? [rows[0].id] : []));
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="nrows">
      {rows.map((row) => {
        const isOpen = open.has(row.id);
        const head = `${base}-${row.id}-q`;
        const body = `${base}-${row.id}-a`;
        return (
          <div key={row.id} className={isOpen ? "nrow is-open" : "nrow"}>
            <h3>
              <button type="button" id={head} className="nrow__q" aria-expanded={isOpen} aria-controls={body} onClick={() => toggle(row.id)}>
                <span>{row.question}</span>
                <i className="nrow__plus" aria-hidden="true" />
              </button>
            </h3>
            <div
              id={body}
              role="region"
              aria-labelledby={head}
              className="nrow__a"
              aria-hidden={!isOpen}
              // React 18 has no `inert` prop: the attribute goes on only while closed.
              {...((isOpen ? {} : { inert: "" }) as Record<string, string>)}
            >
              <div>
                <div className="nrow__in">{row.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
