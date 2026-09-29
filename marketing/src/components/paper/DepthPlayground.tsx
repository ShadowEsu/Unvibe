"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

const DEPTHS = ["New", "Beginner", "Intermediate", "Advanced", "Expert"] as const;

interface Sample {
  id: string;
  label: string;
  file: string;
  code: string;
  explanations: [string, string, string, string, string];
}

const SAMPLES: Sample[] = [
  {
    id: "js",
    label: "JavaScript",
    file: "debounce.js",
    code: `function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}`,
    explanations: [
      "Picture an elevator door that waits a moment before closing, and restarts the wait each time someone steps in. This does the same for a function: it only runs once things go quiet.",
      "debounce takes a function and a delay in milliseconds. Every call cancels the previous timer with clearTimeout and starts a new one, so fn only runs after ms milliseconds with no new calls.",
      "A classic debounce built on a closure. timer survives between calls, and the returned arrow function forwards its arguments with rest and spread. Handy for search boxes and resize handlers.",
      "It is trailing-edge only, so the first call is always delayed, and this is not preserved because the wrapper is an arrow function. There is no cancel or flush, so a pending call can fire after a component unmounts.",
      "Each call allocates a new timer and closure over args, which adds GC churn under very frequent events. A leading-edge option, maxWait, and cleanup through an AbortSignal would make it production grade.",
    ],
  },
  {
    id: "py",
    label: "Python",
    file: "top_words.py",
    code: `counts = {}
for word in text.split():
    counts[word] = counts.get(word, 0) + 1
top = sorted(counts.items(),
             key=lambda kv: kv[1],
             reverse=True)[:3]`,
    explanations: [
      "It counts how often each word appears, like tallying votes on a whiteboard, then keeps the three most popular.",
      "The loop splits the text into words. counts.get(word, 0) returns the tally so far, or 0, and adds 1. sorted orders the pairs by count, biggest first, and [:3] keeps the top three.",
      "A hand-built frequency map. collections.Counter(text.split()).most_common(3) does the same in one line and runs in C, so it is faster.",
      "split() splits on any whitespace, so punctuation stays attached: \"code\" and \"code,\" count separately. Sorting everything is O(n log n) when you only need three; heapq.nlargest does it in O(n log 3).",
      "Ties keep their first-seen order because Python's sort is stable, so results are deterministic. For huge inputs, stream the text and count lazily instead of building the whole split() list in memory.",
    ],
  },
  {
    id: "sql",
    label: "SQL",
    file: "busy_customers.sql",
    code: `SELECT u.email, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.email
HAVING COUNT(o.id) > 5;`,
    explanations: [
      "It lists each customer's email with how many orders they placed, but only the customers with more than five.",
      "LEFT JOIN keeps every user, even ones without orders. GROUP BY makes one row per email, COUNT(o.id) counts their orders, and HAVING filters those rows after counting.",
      "HAVING runs after grouping, unlike WHERE. COUNT(o.id) skips NULLs, which is why a user with no orders counts as 0, not 1.",
      "Because HAVING needs more than five orders, the LEFT JOIN behaves like an INNER JOIN, and INNER JOIN states the intent better. Grouping by email assumes emails are unique; grouping by u.id is safer.",
      "An index on orders(user_id) turns the join into index lookups. With many users, aggregating orders first in a subquery and joining that small result is often cheaper.",
    ],
  },
];

export function DepthPlayground() {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [depth, setDepth] = useState(2);
  const [shown, setShown] = useState(0);
  const touched = useRef(false);
  const sample = SAMPLES[sampleIndex]!;
  const text = sample.explanations[depth]!;

  // Stream the explanation in, the way the app does.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const timer = window.setInterval(() => {
      setShown((value) => {
        if (value >= text.length) {
          window.clearInterval(timer);
          return value;
        }
        return Math.min(text.length, value + 3);
      });
    }, 14);
    return () => window.clearInterval(timer);
  }, [text]);

  const note = (kind: string) => {
    if (touched.current) return;
    touched.current = true;
    track("playground_used", { kind });
  };

  return (
    <div className="pg paper-glass">
      <div className="pg__tabs" role="tablist" aria-label="Code sample">
        {SAMPLES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === sampleIndex}
            className={index === sampleIndex ? "is-on" : undefined}
            onClick={() => { setSampleIndex(index); note("sample"); }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="pg__body">
        <div className="pg__code">
          <div className="pg__file">{sample.file}</div>
          <pre><code>{sample.code}</code></pre>
        </div>

        <div className="pg__out">
          <label className="pg__dial">
            <span>
              Depth <strong>{DEPTHS[depth]}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={4}
              step={1}
              value={depth}
              onChange={(event) => { setDepth(Number(event.target.value)); note("depth"); }}
              aria-valuetext={DEPTHS[depth]}
            />
            <span className="pg__ticks" aria-hidden="true">
              {DEPTHS.map((label, index) => (
                <button key={label} type="button" tabIndex={-1} className={index === depth ? "is-on" : undefined} onClick={() => { setDepth(index); note("depth"); }}>
                  {label}
                </button>
              ))}
            </span>
          </label>
          <p className="pg__text" aria-live="polite">
            {text.slice(0, shown)}
            {shown < text.length ? <span className="pg__caret" aria-hidden="true" /> : null}
          </p>
          <p className="pg__foot">Written by hand to show the range. In the app, explanations are generated for your own code.</p>
        </div>
      </div>
    </div>
  );
}
