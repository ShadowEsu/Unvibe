/**
 * The hero's count-up (package-1106 SPEC §6): a row of TRUE product facts, each one Security-checked before it ships;
 * pass them in, never a user count, never a latency.
 *
 * Each digit rolls up once (600 ms, items 80 ms apart): a column 0…d slides up in a one-line window, transform only, so
 * it needs no JS and no `@property`, never shifts layout, and at rest (reduced motion, no animation support) shows the
 * final digit. The real number is in the HTML for screen readers and search; the rolling columns are hidden from them.
 */
import type { CSSProperties } from "react";

export interface Count { value: number; label: string }

export function CountUp({ items, delayMs = 900, after }: { items: readonly Count[]; delayMs?: number; after?: string }) {
  return (
    // one wrapping row on one baseline grid: the facts, then the plain line as a 4th group (Design gate r7 nit at 390)
    <dl className="mx-cu">
      {items.map((item, i) => (
        <div key={item.label} className="mx-cu__item" style={{ "--mx-d": `${delayMs + i * 80}ms` } as CSSProperties}>
          <dt className="mx-cu__l">{item.label}</dt>
          <dd className="mx-cu__n">
            <span className="mx-cu__sr">{item.value}</span>
            <span className="mx-cu__roll" aria-hidden="true">
              {Array.from(String(item.value), (digit, j) => (
                <span key={j} className="mx-cu__win">
                  <span className="mx-cu__col" style={{ "--mx-to": Number(digit) } as CSSProperties}>
                    {Array.from({ length: Number(digit) + 1 }, (_, n) => <span key={n}>{n}</span>)}
                  </span>
                </span>
              ))}
            </span>
          </dd>
        </div>
      ))}
      {after ? (
        <div className="mx-cu__item" style={{ "--mx-d": `${delayMs + items.length * 80 + 200}ms` } as CSSProperties}>
          <dt className="mx-cu__sr">Also</dt>
          <dd className="mx-cu__after">{after}</dd>
        </div>
      ) : null}
    </dl>
  );
}
