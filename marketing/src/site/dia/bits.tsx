"use client";

import { useId, useState, type ReactNode } from "react";
import type { Title } from "./content";

/** A title written as before / word / after (direction D's italic word). Option A sets it as one plain line. */
export function T({ t }: { t: Title }) {
  return <>{t.before} {t.em}{t.after ?? ""}</>;
}

/** A string, or a Mac/Windows pair (both in the HTML; the pre-paint OS class shows one). */
export function Os({ v }: { v: string | { readonly mac: string; readonly windows: string } }) {
  return typeof v === "string" ? <>{v}</> : <><span className="lx-mac">{v.mac}</span><span className="lx-win">{v.windows}</span></>;
}

/**
 * Short answers: <button aria-expanded> rows split by 1 px rules, the first open. Every answer is in the HTML
 * (crawlable, FAQPage JSON-LD unchanged in shape); a closed answer is collapsed to 0 rows and inert. The + turns into
 * a − and the answer opens in 160 ms (CSS grid rows); reduced motion: at once.
 */
export function Faq({ items }: { items: ReadonlyArray<{ id: string; question: string; answer: ReactNode }> }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const base = useId();
  return (
    <div className="d-faq">
      {items.map((item) => {
        const on = open === item.id;
        return (
          <div key={item.id} className="d-faq__item" data-open={on ? "" : undefined}>
            <h3>
              <button type="button" id={`${base}-${item.id}-q`} aria-expanded={on} aria-controls={`${base}-${item.id}-a`} onClick={() => setOpen(on ? null : item.id)}>
                {item.question}
                <span className="d-faq__pm" aria-hidden="true" />
              </button>
            </h3>
            {/* React 18 has no typed `inert`; an unknown lowercase attribute passes through as is */}
            <div className="d-faq__a" id={`${base}-${item.id}-a`} role="region" aria-labelledby={`${base}-${item.id}-q`} {...((on ? {} : { inert: "" }) as object)}>
              <div>{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
