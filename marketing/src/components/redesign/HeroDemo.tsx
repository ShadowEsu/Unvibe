"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw } from "lucide-react";

const code = [
  "export function useSyncedDraft(id: string) {",
  "  const [draft, setDraft] = useState('');",
  "  useEffect(() => {",
  "    const next = cache.get(id) ?? '';",
  "    setDraft(next);",
  "  }, [id]);",
  "  return { draft, setDraft };",
  "}",
];

const explanation =
  "This hook keeps the editor draft aligned with the active document. Whenever id changes, useEffect reads that document's cached draft and updates React state.";

const TOTAL = 9_000;
const timeline = {
  select: 350,
  activate: 950,
  depth: 1_450,
  streamStart: 1_850,
  streamEnd: 4_650,
  context: 4_900,
  check: 6_050,
  answer: 6_850,
  save: 7_550,
};

function stageLabel(elapsed: number): string {
  if (elapsed < timeline.select) return "Detecting change";
  if (elapsed < timeline.activate) return "Selecting code";
  if (elapsed < timeline.streamStart) return "Choosing depth";
  if (elapsed < timeline.context) return "Explaining";
  if (elapsed < timeline.check) return "Connecting context";
  if (elapsed < timeline.answer) return "Checking understanding";
  if (elapsed < timeline.save) return "Answering";
  return "Saved to project";
}

export function HeroDemo() {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPaused(true);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tick = useCallback((now: number) => {
    if (lastFrameRef.current === null) lastFrameRef.current = now;
    const delta = Math.min(now - lastFrameRef.current, 80);
    lastFrameRef.current = now;
    accumulatedRef.current += delta;
    if (accumulatedRef.current >= 32) {
      const step = accumulatedRef.current;
      accumulatedRef.current = 0;
      setElapsed((current) => (current + step) % TOTAL);
    }
    frameRef.current = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || !visible) {
      lastFrameRef.current = null;
      accumulatedRef.current = 0;
      return;
    }
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      lastFrameRef.current = null;
      accumulatedRef.current = 0;
    };
  }, [paused, reducedMotion, tick, visible]);

  const current = reducedMotion ? timeline.save + 250 : elapsed;
  const selected = current >= timeline.select;
  const activated = current >= timeline.activate;
  const depthVisible = current >= timeline.depth;
  const contextVisible = current >= timeline.context;
  const checkVisible = current >= timeline.check;
  const answered = current >= timeline.answer;
  const saved = current >= timeline.save;
  const streamProgress = Math.max(0, Math.min(1, (current - timeline.streamStart) / (timeline.streamEnd - timeline.streamStart)));
  const streamedExplanation = explanation.slice(0, Math.floor(explanation.length * streamProgress));
  const streaming = current >= timeline.streamStart && current < timeline.streamEnd && !reducedMotion;

  const jumpToExplanation = () => {
    setElapsed(timeline.streamStart);
    if (!reducedMotion) setPaused(false);
  };

  return (
    <div ref={rootRef} className="demo-shell" aria-label="Animated Unvibe code explanation demonstration">
      <div className="demo-toolbar">
        <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
        <span className="demo-file"><span className="pixel-file" aria-hidden="true" />useSyncedDraft.ts</span>
        <span className="demo-brand"><span className="brand-pixel" aria-hidden="true" />UNVIBE</span>
      </div>

      <div className="demo-grid">
        <div className="code-pane" aria-label="TypeScript code sample">
          <div className="code-meta"><span>TypeScript</span><span>React hook</span><span>Editor state</span></div>
          <pre><code>{code.map((line, index) => (
            <span key={line} className={selected && index >= 2 && index <= 5 ? "is-selected" : ""}>
              <b>{String(index + 1).padStart(2, "0")}</b>{line}
            </span>
          ))}</code></pre>
          <button className={`activate-chip ${activated ? "is-active" : ""}`} type="button" onClick={jumpToExplanation}>
            <span className="brand-pixel" aria-hidden="true" />{activated ? "Explaining selection" : "Explain selection"}
          </button>
        </div>

        <div className={`explain-pane ${activated ? "is-open" : ""}`}>
          <div className="explain-topline"><span>BEGINNER</span><span>{stageLabel(current)}</span></div>
          <div className="pixel-track" aria-hidden="true"><i className={selected ? "is-on" : ""} /><i className={activated ? "is-on" : ""} /><i className={depthVisible ? "is-on" : ""} /><i className={contextVisible ? "is-on" : ""} /><i className={checkVisible ? "is-on" : ""} /><i className={saved ? "is-on" : ""} /></div>

          <div className={`demo-recognition ${activated ? "is-visible" : ""}`}>
            <span>useEffect</span><span>cache lookup</span><span>state sync</span>
          </div>
          <div className={`demo-depth ${depthVisible ? "is-visible" : ""}`}>
            <span>First time</span><span className="active">Beginner</span><span>Intermediate</span><span>Advanced</span>
          </div>

          <div className="demo-explain-copy">
            <p className="explain-kicker">What this code actually does</p>
            <h3>Keeps the right draft attached to the right document.</h3>
            <p className="streamed-copy" aria-hidden="true">
              {streamedExplanation}{streaming && <i className="stream-caret" />}
            </p>
            <span className="sr-only">{explanation}</span>
          </div>

          {contextVisible && (
            <div className="explanation-points">
              <span><strong>Trigger</strong><small><code>id</code> changes</small></span>
              <span><strong>Behavior</strong><small>Load cache → update state</small></span>
              <span><strong>Impact</strong><small>No draft leaks between documents</small></span>
            </div>
          )}

          {checkVisible && !saved && (
            <div className="demo-check">
              <strong>Quick check: why is <code>id</code> a dependency?</strong>
              <div><span>For styling</span><span className={answered ? "correct" : ""}>{answered && <Check size={12} />}To reload on document change</span></div>
            </div>
          )}

          {saved && (
            <div className="demo-saved"><Check size={16} /><span><strong>Concept saved</strong><small>Effect dependencies · this project</small></span></div>
          )}
        </div>
      </div>

      <div className="demo-controls">
        <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play demonstration" : "Pause demonstration"} aria-pressed={!paused}>
          {paused ? <Play size={15} /> : <Pause size={15} />}<span>{paused ? "Play" : "Pause"}</span>
        </button>
        <div className="demo-progress" aria-hidden="true"><i style={{ width: `${(current / TOTAL) * 100}%` }} /></div>
        <span className="demo-step-label">{stageLabel(current)}</span>
        <button type="button" onClick={() => { setElapsed(0); if (!reducedMotion) setPaused(false); }} aria-label="Replay demonstration"><RotateCcw size={15} /><span>Replay</span></button>
      </div>
    </div>
  );
}
