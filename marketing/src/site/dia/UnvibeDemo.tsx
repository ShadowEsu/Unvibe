"use client";

/**
 * The live demo (direction D's centrepiece; BRIEF.md "The demo"): the Unvibe 0.1.49 panel recreated in HTML from
 * Design's round-06 app.html and the real 0.1.49 UI, run as one scripted 16 s loop in the real app order:
 * select 7 lines → the shortcut keycaps press → the panel slides in → the Beginner answer streams word by word →
 * the depth menu picks Advanced → Test me (question 1), the right answer, Vibe's verdict → "Understand ✓" (squash) and
 * the real "saved on this Mac" → reset. Security 18:22Z: no toast (a concept, not in 0.1.49), the real button label.
 * Timings are the app's measured values (agents/motion/app-0151): words fade 120 ms, panel in 250 ms from 12 px,
 * depth menu 140 ms in / 100 ms out, chip label 160 ms, button press 3 px / release 180 ms, Vibe squash 240 ms.
 *
 * One rAF clock; every frame derives the whole state from t and writes only data attributes and classes (CSS does
 * transform/opacity). It pauses off screen and in a hidden tab. `step` (0/1/2) loops one segment for the steps
 * section. Reduced motion: the final frame (Advanced answer, understood state), static.
 */
import { useEffect, useRef, useState } from "react";
import { Os } from "./bits";

const LOOP = 16;
const SEGMENTS: Record<0 | 1 | 2, [number, number]> = { 0: [0, 2.2], 1: [1.2, 4.6], 2: [6.6, 15] };

const CODE = [
  "function debounce(fn, wait) {",
  "  let timer;",
  "  return (...args) => {",
  "    clearTimeout(timer);",
  "    timer = setTimeout(() => fn(...args), wait);",
  "  };",
  "}",
];
const CONTEXT_BEFORE = ["// search.js: run the search once typing stops", ""];
const CONTEXT_AFTER = ["", "const search = debounce(runSearch, 300);", "input.addEventListener(\"input\", (e) => search(e.target.value));"];
/** The window's file sidebar (Design mock 01): sample project, sample names. */
const FILES = ["search.js", "debounce.js", "totals.js", "README.md"];

/** Beginner answer: Design round-06 app.html (Security-vetted). `code` words are inline code. */
const BEGINNER: ReadonlyArray<ReadonlyArray<string>> = [
  ["`debounce`", "wraps", "a", "function", "`fn`", "so", "it", "only", "runs", "after", "calls", "stop", "for", "`wait`", "milliseconds."],
  ["Each", "call", "cancels", "the", "pending", "timer", "with", "`clearTimeout`", "and", "starts", "a", "new", "one", "with", "`setTimeout`.", "So", "if", "calls", "keep", "coming", "quickly,", "`fn`", "waits,", "then", "runs", "once", "with", "the", "most", "recent", "`args`."],
  ["Useful", "for", "search", "boxes,", "where", "you", "only", "want", "to", "react", "after", "someone", "stops", "typing."],
];
/** Advanced short answer: the real 0.1.49 panel at Advanced depth (public/unvibe/real/0149/panel-advanced). */
const ADVANCED: ReadonlyArray<ReadonlyArray<string>> = [
  ["`clearTimeout`", "on", "line", "4", "cancels", "the", "call", "scheduled", "by", "the", "previous", "invocation,", "and", "`setTimeout`", "on", "line", "5", "schedules", "a", "new", "one.", "Together", "they", "restart", "the", "countdown", "on", "every", "call."],
  ["That", "restart", "is", "what", "makes", "this", "a", "debounce:", "`fn`", "runs", "only", "after", "`wait`", "ms", "pass", "with", "no", "further", "calls."],
];
const DEPTHS = ["New", "Beginner", "Intermediate", "Advanced"] as const;
/** The 0.1.49 panel's icon rail, its own labels (Explain is the open view). */
const RAIL = [{ label: "Explain", glyph: "‹›" }, { label: "Depth", glyph: "≡" }, { label: "Quiz", glyph: "?" }, { label: "Ask", glyph: "↗" }, { label: "Why", glyph: "!" }, { label: "Teach", glyph: "◇" }] as const;
const QUIZ = {
  kicker: "Test me",
  q: ["Calls arrive 50 ms apart and ", "wait", " is 300 ms. When does ", "fn", " run?"],
  opts: ["On the first call", "Every 300 ms while the calls continue", "Once, 300 ms after the last call", "Never, the timer keeps resetting"],
  right: 2,
  verdict: "Correct. That one is understood.",
  why: "Every call clears the old timer, so only the last one lives long enough to fire.",
};

function Words({ paras, group }: { paras: ReadonlyArray<ReadonlyArray<string>>; group: string }) {
  let i = 0;
  return (
    <div className="ud-prose" data-ud-group={group}>
      {paras.map((words, pi) => (
        <p key={pi}>
          {words.map((w, wi) => {
            const n = i++;
            const code = w.startsWith("`");
            const text = w.replace(/`/g, "");
            const tail = code && /[.,:]$/.test(text) ? text.slice(-1) : "";
            return (
              <span key={wi} className="ud-w" data-n={n}>
                {code ? <><code>{tail ? text.slice(0, -1) : text}</code>{tail}</> : text}{wi < words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
const count = (paras: ReadonlyArray<ReadonlyArray<string>>) => paras.reduce((a, p) => a + p.length, 0);
const NB = count(BEGINNER), NA = count(ADVANCED);

/** The state at time t (s): phase flags + how many words of each answer are shown. */
function stateAt(t: number) {
  const sel = Math.max(0, Math.min(CODE.length, Math.floor((t - 0.2) / 0.19) + 1));
  return {
    sel: t < 15 ? sel : 0,
    keys: t >= 1.6 && t < 2.6,
    press: t >= 1.75 && t < 1.93,
    panel: t >= 2.0 && t < 15,
    status: t < 6.5 ? "explaining" : "ready to learn",
    beginner: Math.max(0, Math.min(NB, Math.floor((t - 2.4) * (NB / 3.9)))),
    menu: t >= 7.0 && t < 7.9,
    pick: t >= 7.55,
    advanced: t >= 7.9 ? Math.max(0, Math.min(NA, Math.floor((t - 7.9) * (NA / 1.4)))) : 0,
    testPress: t >= 9.4 && t < 9.58,
    quiz: t >= 9.5 && t < 12.4,
    chosen: t >= 10.7,
    verdict: t >= 11.0,
    gotPress: t >= 12.5 && t < 12.68,
    happy: t >= 12.7,
    saved: t >= 12.95 && t < 15,
    fade: t >= 15,
  };
}

export function UnvibeDemo({ step }: { step?: 0 | 1 | 2 }) {
  const root = useRef<HTMLDivElement>(null);
  // WCAG 2.2.2: the loop runs longer than 5 s, so a visible, labelled Pause/Play button stops it (reduced motion: no loop).
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const syncRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    pausedRef.current = paused;
    syncRef.current();
  }, [paused]);
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const fit = new ResizeObserver(([e]) => el.style.setProperty("--ud-k", (e.contentRect.width / 1115).toFixed(4)));
    fit.observe(el);
    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s);
    const lines = Array.from(el.querySelectorAll<HTMLElement>(".ud-line[data-sel-i]"));
    const bWords = Array.from(el.querySelectorAll<HTMLElement>('[data-ud-group="b"] .ud-w'));
    const aWords = Array.from(el.querySelectorAll<HTMLElement>('[data-ud-group="a"] .ud-w'));
    const flags = ["keys", "press", "panel", "menu", "pick", "testPress", "quiz", "chosen", "verdict", "gotPress", "happy", "saved", "fade"] as const;
    const status = q<HTMLElement>(".ud-status");
    let last = "";
    const apply = (t: number) => {
      const s = stateAt(t);
      const sig = JSON.stringify(s);
      if (sig === last) return;
      last = sig;
      lines.forEach((ln, i) => ln.toggleAttribute("data-on", i < s.sel));
      bWords.forEach((w, i) => w.toggleAttribute("data-on", i < s.beginner));
      aWords.forEach((w, i) => w.toggleAttribute("data-on", i < s.advanced));
      for (const f of flags) el.toggleAttribute(`data-${f.toLowerCase()}`, Boolean(s[f]));
      el.toggleAttribute("data-adv", s.advanced > 0);
      if (status) status.textContent = s.status;
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply(14.2);
      el.setAttribute("data-static", "");
      return () => fit.disconnect();
    }
    const [from, to] = step === undefined ? [0, LOOP] : SEGMENTS[step];
    let raf = 0, start = 0, offset = 0, running = false;
    const frame = (now: number) => {
      if (!start) start = now - offset * 1000;
      const local = ((now - start) / 1000) % (to - from + (step === undefined ? 0 : 0.8));
      offset = local;
      apply(Math.min(to, from + local));
      raf = requestAnimationFrame(frame);
    };
    const play = () => { if (!running) { running = true; start = 0; raf = requestAnimationFrame(frame); } };
    const pause = () => { running = false; cancelAnimationFrame(raf); };
    let inView = false;
    const sync = () => (inView && !document.hidden && !pausedRef.current ? play() : pause());
    syncRef.current = sync;
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.15 });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    apply(from);
    return () => { syncRef.current = () => undefined; pause(); io.disconnect(); fit.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [step]);

  const keyset = (keys: string[], os: string) => <span className={`ud-keys__set ${os}`}>{keys.map((k) => <span key={k} className="ud-key">{k}</span>)}</span>;
  const all = [...CONTEXT_BEFORE, ...CODE, ...CONTEXT_AFTER];
  return (
    <div className="ud-wrap">
    <button type="button" className="ud-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? "Play demo" : "Pause demo"}</button>
    <div className="ud" ref={root} aria-hidden="true" data-ud-step={step ?? "loop"}>
      <div className="ud-stage">
        <div className="ud-editor">
          <div className="ud-tabs"><span className="ud-dots"><i /><i /><i /></span><span className="ud-tab">debounce.js</span></div>
          <div className="ud-side">
            <span className="ud-side__p">sample-app</span>
            {FILES.map((f) => <span key={f} className={f === "debounce.js" ? "ud-side__f ud-side__f--on" : "ud-side__f"}>{f}</span>)}
          </div>
          <pre className="ud-code">
            {all.map((line, i) => {
              const ci = i - CONTEXT_BEFORE.length;
              const inSel = ci >= 0 && ci < CODE.length;
              return (
                <span key={i} className="ud-line" data-sel-i={inSel ? ci : undefined}>
                  <span className="ud-ln">{i + 1}</span><span className="ud-src">{line || " "}</span>
                </span>
              );
            })}
          </pre>
          <div className="ud-keys">{keyset(["Control", "U"], "lx-mac")}{keyset(["Ctrl", "Alt", "U"], "lx-win")}</div>
        </div>

        {/* The real 0.1.49 panel's layout (public/unvibe/real/0149/*): header, icon rail, Review tab, depth chips,
            the selected-code card, the answer, the three buttons + "Saved on this Mac", the follow-up box. */}
        <div className="ud-panel">
          <div className="ud-head">
            {/* eslint-disable-next-line @next/next/no-img-element -- Vibe, our mark */}
            <img className="ud-vibe" src="/brand/vibe.svg" width={28} height={28} alt="" />
            <div className="ud-meta"><div className="ud-t">Unvibe</div><div className="ud-s">7 lines · javascript · from Cursor</div></div>
            <span className="ud-statusdot" /><span className="ud-status">explaining</span>
            <span className="ud-icon ud-icon--wide">Saved</span>
            <span className="ud-icon">✕</span>
          </div>
          <div className="ud-main">
            <div className="ud-rail">
              {RAIL.map((r, i) => <span key={r.label} className={i === 0 ? "ud-rail__i ud-rail__i--on" : "ud-rail__i"}><span className="ud-rail__g">{r.glyph}</span>{r.label}</span>)}
            </div>
            <div className="ud-col">
              <div className="ud-tabrow"><span className="ud-rtab">Review <small>✕</small></span><span className="ud-rtab ud-rtab--add">+</span></div>
              <div className="ud-bar">
                <span className="ud-bar__l">Depth</span>
                {DEPTHS.map((d) => <span key={d} className={`ud-chip ud-chip--${d.toLowerCase()}`}>{d}</span>)}
                <span className="ud-chip">Expert <b>Pro</b></span>
              </div>
              <div className="ud-body">
                <div className="ud-codeblock">
                  <span className="ud-more"><span>Selected code</span><span>javascript</span></span>
                  {CODE.slice(0, 3).map((l) => <span key={l} className="ud-cl">{l}</span>)}
                </div>
                <div className="ud-answers">
                  <Words paras={BEGINNER} group="b" />
                  <Words paras={ADVANCED} group="a" />
                </div>
                <div className="ud-quiz">
                  <div className="ud-quiz__k">{QUIZ.kicker}</div>
                  <div className="ud-quiz__q">{QUIZ.q.map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>))}</div>
                  {QUIZ.opts.map((o, i) => (
                    <div key={o} className={i === QUIZ.right ? "ud-opt ud-opt--right" : "ud-opt"}><span className="ud-opt__l"><span className="ud-opt__x">{"ABCD"[i]}</span><span className="ud-opt__tick">✓</span></span>{o}</div>
                  ))}
                  <div className="ud-verdict">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Vibe, our mark */}
                    <img className="ud-vibe2" src="/brand/vibe.svg" width={40} height={40} alt="" />
                    <div className="ud-bubble"><b>Vibe</b>{QUIZ.verdict}</div>
                  </div>
                </div>
              </div>
              <div className="ud-foot">
                <div className="ud-actions">
                  <span className="ud-btn ud-btn--primary ud-got">Understand ✓</span>
                  <span className="ud-btn">Explain differently</span>
                  <span className="ud-btn ud-btn--test ud-test">Test me</span>
                  <span className="ud-saved"><Os v={{ mac: "Saved on this Mac", windows: "Saved on this PC" }} /></span>
                </div>
                <div className="ud-ask">Why does this exist? What breaks if I remove it?<span className="ud-send">↑</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
