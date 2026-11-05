"use client";

import { useEffect, useRef, useState } from "react";

/** The live 466 copy ("Select it, and Vibe explains …"), one ending at a time. */
const PREFIX = "Select it, and Vibe explains";
const ITEMS = ["a React hook.", "a SQL query.", "a regex.", "a shell script.", "the diff your agent just wrote."] as const;
/** How long each ending stays selected before the next one. */
const HOLD_MS = 2400;

/**
 * The page's statement: the ending changes the way the product works. The new phrase rises in and a lime
 * selection sweeps across it, like code selected in an editor. Screen readers get the whole sentence
 * with every ending once (the moving copy is aria-hidden). It only runs while on screen and in a visible
 * tab; with reduced motion every ending is listed, still.
 */
export function SelectLine() {
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const node = root.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let timer = 0;
    let visible = false;
    const sync = () => {
      window.clearInterval(timer);
      if (visible && !document.hidden) timer = window.setInterval(() => setIndex((value) => (value + 1) % ITEMS.length), HOLD_MS);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    io.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <section className="b-sec b-select" ref={root} aria-label="What Unvibe can explain">
      <div className="b-wrap">
        <p className="sr-only">
          {PREFIX} {ITEMS.join(" ")}
        </p>
        <p className="b-select__line" aria-hidden="true">
          <span className="b-select__prefix">{PREFIX}</span>{" "}
          <span className="b-select__slot">
            {ITEMS.map((item, i) => (
              <span key={item} className={i === index ? "b-select__item is-on" : "b-select__item"}>
                {item}
              </span>
            ))}
          </span>
        </p>
      </div>
    </section>
  );
}
