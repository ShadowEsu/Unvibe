"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type IslandPos = "top" | "bottom" | "left" | "right" | "corner";
type IslandMode = "dim-idle" | "always" | "click-only";

const POS_STYLE: Record<IslandPos, string> = {
  top: "top-4 left-1/2 -translate-x-1/2",
  bottom: "bottom-4 left-1/2 -translate-x-1/2",
  left: "left-4 top-1/2 -translate-y-1/2",
  right: "right-4 top-1/2 -translate-y-1/2",
  corner: "bottom-4 right-4",
};

export function IslandDemo() {
  const [pos, setPos] = useState<IslandPos>("bottom");
  const [mode, setMode] = useState<IslandMode>("dim-idle");
  const [idle, setIdle] = useState(false);
  const [hover, setHover] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const idleTimer = useRef<number | null>(null);

  const poke = () => {
    setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (mode === "dim-idle") {
      idleTimer.current = window.setTimeout(() => setIdle(true), 2200);
    }
  };

  useEffect(() => {
    poke();
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pos]);

  const fireShortcut = () => {
    poke();
    setPulse(true);
    setNote("Reviewing selection…");
    window.setTimeout(() => setPulse(false), 900);
    window.setTimeout(() => setOpen(true), 450);
    window.setTimeout(() => setNote(""), 4000);
  };

  const expanded = mode === "always" ? true : mode === "click-only" ? open : hover || open || !idle;
  const dimmed = mode === "dim-idle" && idle && !hover && !open;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-black text-white overflow-hidden">
      <div className="flex flex-wrap gap-2 p-4 border-b border-neutral-800 text-xs">
        <div className="flex gap-1 items-center mr-4">
          <span className="text-neutral-500 uppercase tracking-widest mr-2">Pin</span>
          {(["top", "bottom", "left", "right", "corner"] as IslandPos[]).map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`px-2.5 py-1 rounded-full border ${pos === p ? "bg-white text-black border-white" : "border-neutral-700 text-neutral-300 hover:border-neutral-400"}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-neutral-500 uppercase tracking-widest mr-2">Mode</span>
          {(["dim-idle", "always", "click-only"] as IslandMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded-full border ${mode === m ? "bg-white text-black border-white" : "border-neutral-700 text-neutral-300 hover:border-neutral-400"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={fireShortcut}
          className="ml-auto px-3 py-1 rounded-full bg-white text-black font-mono text-xs hover:bg-neutral-200"
        >
          ⌘U — simulate shortcut
        </button>
      </div>

      {/* stage */}
      <div
        className="relative h-[340px] bg-[radial-gradient(ellipse_at_center,#181818_0%,#000_70%)] overflow-hidden"
        onMouseMove={poke}
      >
        {/* fake editor behind */}
        <div className="absolute inset-6 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 font-mono text-[11px] leading-relaxed text-neutral-400 select-none">
          <div className="text-neutral-600">{`// cursor — payment-intent.ts`}</div>
          <div><span className="text-neutral-500">const</span> <span className="text-white">intent</span> = <span className="text-neutral-500">await</span> <span className="text-white">stripe.paymentIntents.create</span>({"{"}</div>
          <div className="bg-white/10 border-l-2 border-white pl-2 text-neutral-200">  amount, currency, <span className="bg-white text-black px-1 rounded">customer: user.id</span>,</div>
          <div>{"}"});</div>
          <div className="mt-3 text-neutral-600">↑ select code, then press ⌘U</div>
        </div>

        <div className={`absolute ${POS_STYLE[pos]} z-10`}>
          <motion.div
            onHoverStart={() => setHover(true)}
            onHoverEnd={() => setHover(false)}
            onClick={() => setOpen((v) => !v)}
            animate={{
              opacity: dimmed ? 0.35 : 1,
              scale: pulse ? [1, 1.12, 1] : 1,
              y: dimmed ? 2 : 0,
            }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="relative flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/95 pl-2 pr-1.5 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.6)] backdrop-blur cursor-pointer min-w-[210px]"
          >
            {pulse && (
              <motion.span
                initial={{ scale: 0.6, opacity: 0.9 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border border-white"
              />
            )}
            <span className="w-6 h-6 rounded-full bg-white text-black grid place-items-center font-bold text-xs">U</span>
            <AnimatePresence mode="wait">
              {note ? (
                <motion.span key="note" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs text-neutral-200 pr-1">
                  {note}
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-xs">
                  <span className="font-semibold">Unvibe</span>
                  {expanded && (
                    <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} className="overflow-hidden whitespace-nowrap text-neutral-400">
                      Review selection <kbd className="ml-1 px-1.5 py-0.5 rounded border border-neutral-700 bg-black font-mono">⌘U</kbd>
                    </motion.span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
            <span className="ml-auto flex gap-1">
              <span className="w-6 h-6 rounded-full hover:bg-white hover:text-black grid place-items-center text-xs" title="Review">▸</span>
              <span className="w-6 h-6 rounded-full hover:bg-white hover:text-black grid place-items-center text-xs" title="Home">⌂</span>
            </span>
          </motion.div>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="mt-2 w-[300px] rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-xs shadow-2xl"
              >
                <div className="flex items-center justify-between text-neutral-500 mb-2">
                  <span>EXPLANATION · STREAMING</span>
                  <button onClick={(e) => { e.stopPropagation(); setOpen(false); }} className="hover:text-white">✕</button>
                </div>
                <p className="text-neutral-200 leading-relaxed">Creates a <b>payment intent</b> for this customer. Amount is in minor units — pass <code className="bg-white/10 px-1 rounded">cents</code>, not dollars.</p>
                <div className="flex gap-1.5 mt-3">
                  {["New", "Beginner", "Intermediate", "Advanced", "Expert"].map((l, i) => (
                    <span key={l} className={`px-1.5 py-0.5 rounded-full border text-[10px] ${i === 2 ? "bg-white text-black border-white" : "border-neutral-700 text-neutral-400"}`}>{l}</span>
                  ))}
                </div>
                <div className="flex gap-1.5 mt-3">
                  <span className="flex-1 text-center px-2 py-1 rounded-lg bg-white text-black font-semibold">I understand</span>
                  <span className="flex-1 text-center px-2 py-1 rounded-lg border border-neutral-700">Test me</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-2 left-3 font-mono text-[10px] text-neutral-600">
          {dimmed ? "● dimmed — idle 2.2s, hover to wake" : expanded ? "● awake — expanded" : "● idle"} · pos: {pos} · mode: {mode}
        </div>
      </div>
    </div>
  );
}
