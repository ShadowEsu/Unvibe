/**
 * The homepage hero demo (ledger 469 B): the same 7 lines the real 0.1.48 panel screenshot shows as
 * "Selected code" (`/unvibe/real/panel-explained-top.webp`, "7 lines · javascript"), so the scripted
 * selection never shows more or less than the panel explains (Security, 469 vote).
 */
export const DEMO_CODE = [
  "function debounce(fn, wait) {",
  "  let timer;",
  "  return (...args) => {",
  "    clearTimeout(timer);",
  "    timer = setTimeout(() => fn(...args), wait);",
  "  };",
  "}",
] as const;

/**
 * done: the finished frame (selection on, panel shown), which is also the server HTML;
 * reset: selection and panel fade away; select: the selection sweeps down the lines;
 * keys: the shortcut keys press one after another.
 */
export type DemoPhase = "done" | "reset" | "select" | "keys";

/** Design's B timings (BUILD-B.md): sweep 500 ms, each key 120 ms, panel 600 ms, hold 4 s. */
export const DEMO_TIMING = { reset: 500, sweep: 500, key: 120, panel: 600, hold: 4000 } as const;

/** One loop as [phase, how long to stay in it] pairs; the loop repeats from the top. */
export function demoPhases(keyCount: number): ReadonlyArray<readonly [DemoPhase, number]> {
  const t = DEMO_TIMING;
  return [
    ["reset", t.reset],
    ["select", t.sweep + 150],
    ["keys", keyCount * t.key + 120],
    ["done", t.panel + t.hold],
  ];
}
