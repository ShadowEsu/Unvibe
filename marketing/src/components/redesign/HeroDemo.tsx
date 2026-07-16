"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";

const scenes = [
  { label: "Select", note: "You choose the code worth understanding." },
  { label: "Activate", note: "Unvibe opens beside the work already in progress." },
  { label: "Set depth", note: "Beginner keeps the language clear and concrete." },
  { label: "Explain", note: "The explanation connects behavior to project context." },
  { label: "Check", note: "One question reveals what is clear and what needs another pass." },
  { label: "Save", note: "Keep the concept with the project that taught it." },
] as const;

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

export function HeroDemo() {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible || reduced) return;
    const timer = window.setInterval(() => {
      setScene((current) => (current + 1) % scenes.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [playing, visible, reduced]);

  const move = (direction: number) => {
    setScene((current) => (current + direction + scenes.length) % scenes.length);
  };

  const selected = scene >= 1;
  const explained = scene >= 3;

  return (
    <div ref={root} className="demo-shell" aria-label="Interactive Unvibe product demonstration">
      <div className="demo-toolbar">
        <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
        <span className="demo-file"><span className="pixel-file" aria-hidden="true" />useSyncedDraft.ts</span>
        <span className="demo-brand"><span className="brand-pixel" aria-hidden="true" />UNVIBE</span>
      </div>

      <div className="demo-grid">
        <div className="code-pane" aria-label="Code sample">
          <div className="code-meta"><span>TypeScript</span><span>React hook</span><span>State sync</span></div>
          <pre>
            <code>
              {code.map((line, index) => (
                <span
                  key={line}
                  className={selected && index >= 2 && index <= 5 ? "is-selected" : ""}
                >
                  <b>{String(index + 1).padStart(2, "0")}</b>{line}
                </span>
              ))}
            </code>
          </pre>
          <button className={`activate-chip ${scene >= 2 ? "is-active" : ""}`} type="button" onClick={() => setScene(3)}>
            <span className="brand-pixel" aria-hidden="true" /> Explain selection
          </button>
        </div>

        <div className={`explain-pane ${explained ? "is-open" : ""}`} aria-live="polite">
          <div className="explain-topline"><span>BEGINNER</span><span>{scene + 1}/6</span></div>
          <div className="pixel-track" aria-hidden="true">
            {scenes.map((_, index) => <i key={index} className={index <= scene ? "is-on" : ""} />)}
          </div>
          <p className="explain-kicker">{scenes[scene].label}</p>
          <h3>{explained ? "Keeps a draft in sync with the selected item." : "Select a few lines to begin."}</h3>
          <p>{scenes[scene].note}</p>
          {explained && (
            <div className="concept-row">
              <span>useEffect</span><span>dependency array</span><span className="developing">developing</span>
            </div>
          )}
          <div className="demo-action-row">
            <span>{scene >= 4 ? "Check: why is id a dependency?" : "Context: hook → editor state"}</span>
            <button type="button" onClick={() => setScene(5)}>{scene === 5 ? "Saved ✓" : "Save"}</button>
          </div>
        </div>
      </div>

      <div className="demo-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous demonstration step"><ChevronLeft size={17} /></button>
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? "Pause demonstration" : "Play demonstration"}
          aria-pressed={playing}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
          <span>{playing ? "Pause" : "Play"}</span>
        </button>
        <span className="demo-step-label">{scenes[scene].label}</span>
        <button type="button" onClick={() => { setScene(0); setPlaying(!reduced); }} aria-label="Replay demonstration"><RotateCcw size={15} /><span>Replay</span></button>
        <button type="button" onClick={() => move(1)} aria-label="Next demonstration step"><ChevronRight size={17} /></button>
      </div>
    </div>
  );
}
