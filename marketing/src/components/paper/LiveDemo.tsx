"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Illustrated ⌘U loop: select code, press the shortcut, read a streamed
 * explanation, answer one question. Written by hand, not live model output.
 */

type Token = [kind: "k" | "f" | "s" | "v" | "p" | "c", text: string];

const LINES: Token[][] = [
  [["k", "export async function "], ["f", "getUser"], ["p", "(id: "], ["k", "string"], ["p", ") {"]],
  [["k", "  const "], ["v", "cached"], ["p", " = cache."], ["f", "get"], ["p", "(id);"]],
  [["k", "  if "], ["p", "(cached) "], ["k", "return "], ["v", "cached"], ["p", ";"]],
  [["k", "  const "], ["v", "res"], ["p", " = "], ["k", "await "], ["f", "fetch"], ["p", "("], ["s", "`/api/users/${id}`"], ["p", ");"]],
  [["k", "  if "], ["p", "(!res.ok) "], ["k", "throw new "], ["f", "Error"], ["p", "("], ["s", '"User not found"'], ["p", ");"]],
  [["k", "  const "], ["v", "user"], ["p", " = "], ["k", "await "], ["p", "res."], ["f", "json"], ["p", "();"]],
  [["p", "  cache."], ["f", "set"], ["p", "(id, user);"]],
  [["k", "  return "], ["v", "user"], ["p", ";"]],
  [["p", "}"]],
];

const SELECTED = new Set([1, 2, 3, 4, 5, 6]);

const EXPLANATION =
  "This checks a cache before calling the API. A user fetched earlier comes back instantly. Otherwise it fetches, throws if the request failed, saves the result, and returns it. Watch out: two calls at the same moment both miss the cache and fetch twice.";

const DEPTHS = ["New", "Beginner", "Intermediate", "Advanced", "Expert"] as const;

type Phase = "idle" | "select" | "press" | "stream" | "actions" | "quiz" | "done";

const TIMELINE: Array<[Phase, number]> = [
  ["select", 700],
  ["press", 1500],
  ["stream", 900],
  ["actions", 0],
  ["quiz", 1700],
  ["done", 1500],
];

export function LiveDemo() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(reduce);
    if (reduce) {
      setPhase("done");
      setTyped(EXPLANATION.length);
      return;
    }
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Drive the phases while the demo is on screen; restart the loop after a pause.
  useEffect(() => {
    if (reduced || !visible) return;
    const timers: number[] = [];
    let cancelled = false;

    const run = () => {
      setPhase("idle");
      setTyped(0);
      let at = 600;
      for (const [next, hold] of TIMELINE) {
        if (next === "actions") continue;
        timers.push(window.setTimeout(() => !cancelled && setPhase(next), at));
        if (next === "stream") {
          // Stream the explanation a few characters at a time.
          const start = at + 250;
          const step = 16;
          for (let i = 1; i <= Math.ceil(EXPLANATION.length / 3); i++) {
            timers.push(window.setTimeout(() => !cancelled && setTyped(Math.min(EXPLANATION.length, i * 3)), start + i * step));
          }
          at = start + Math.ceil(EXPLANATION.length / 3) * step + 250;
          timers.push(window.setTimeout(() => !cancelled && setPhase("actions"), at));
        }
        at += hold;
      }
      timers.push(window.setTimeout(() => !cancelled && run(), at + 3200));
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [visible, reduced]);

  const order: Phase[] = ["idle", "select", "press", "stream", "actions", "quiz", "done"];
  const reached = (p: Phase) => order.indexOf(phase) >= order.indexOf(p);

  return (
    <div
      ref={rootRef}
      className="ld"
      data-phase={phase}
      role="img"
      aria-label="Illustration: code is selected in an editor, Command U is pressed, and Unvibe streams a plain-English explanation beside it, then asks a quiz question."
    >
      <div className="ld__window">
        <div className="ld__bar" aria-hidden="true">
          <span /><span /><span />
          <em>users.ts — Cursor</em>
        </div>
        <pre className="ld__code" aria-hidden="true">
          {LINES.map((line, index) => (
            <div
              key={index}
              className={SELECTED.has(index) && reached("select") ? "ld__line is-selected" : "ld__line"}
              style={{ transitionDelay: `${(index - 1) * 55}ms` }}
            >
              <span className="ld__num">{index + 1}</span>
              <code>
                {line.map(([kind, text], tokenIndex) => (
                  <span key={tokenIndex} className={`ld__t-${kind}`}>{text}</span>
                ))}
              </code>
            </div>
          ))}
        </pre>

        <div className={reached("press") ? "ld__keys is-down" : "ld__keys"} aria-hidden="true">
          <kbd>{"⌘"}</kbd>
          <kbd>U</kbd>
        </div>
      </div>

      <div className={reached("stream") ? "ld__card is-open" : "ld__card"} aria-hidden="true">
        <header className="ld__card-head">
          <span className="ld__logo" />
          <strong>Unvibe</strong>
          <small>6 lines · TypeScript · from Cursor</small>
        </header>
        <div className="ld__depths">
          {DEPTHS.map((depth) => (
            <span key={depth} className={depth === "Intermediate" ? "is-on" : undefined}>{depth}</span>
          ))}
        </div>
        <p className="ld__text">
          {EXPLANATION.slice(0, typed)}
          {phase === "stream" ? <span className="ld__caret" /> : null}
        </p>
        <div className={reached("actions") ? "ld__actions is-in" : "ld__actions"}>
          <span>I understand</span>
          <span>Explain differently</span>
          <span className={reached("quiz") ? "is-hot" : undefined}>Test me</span>
        </div>
        <div className={reached("quiz") ? "ld__quiz is-in" : "ld__quiz"}>
          <p>What happens if two calls run at the same moment?</p>
          <span className={reached("done") ? "is-right" : undefined}>
            {reached("done") ? "✓ Both fetch. Correct." : "Both fetch the user"}
          </span>
        </div>
      </div>
      <p className="ld__note">Illustration. Real explanations stream the same way.</p>
    </div>
  );
}
