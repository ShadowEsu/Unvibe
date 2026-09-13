"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CODE = `const intent = await stripe.paymentIntents.create({
  amount, currency, customer: user.id,
});`;

const STREAM = `This creates a PaymentIntent for a known customer.

• amount is in minor units (cents) — 2000 = $20.00
• idempotency key prevents double-charges on retry
• customer: user.id links it for saved cards + receipts

Why it matters: the charge is reviewable later —
Unvibe saves this as a concept you can be tested on.`;

function useTypewriter(active: boolean, text: string, speed = 14) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active) {
      setOut("");
      return;
    }
    let i = 0;
    const t = window.setInterval(() => {
      i += 2;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(t);
    }, speed);
    return () => window.clearInterval(t);
  }, [active, text, speed]);
  return out;
}

export function TerminalStack() {
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(2); // 0 editor, 1 overlay, 2 quiz
  const [tilt, setTilt] = useState(true);
  const [rx, setRx] = useState(-8);
  const [ry, setRy] = useState(12);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setStep((s) => (s + 1) % 3), 4200);
    return () => window.clearInterval(t);
  }, [playing]);

  const streamed = useTypewriter(step >= 1, STREAM, 12);

  const onMouse = (e: React.MouseEvent) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setRy(px * 18);
    setRx(-8 - py * 12);
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-black text-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-neutral-800 text-xs">
        <button onClick={() => setPlaying((v) => !v)} className="px-3 py-1 rounded-full bg-white text-black font-semibold">
          {playing ? "❚❚ pause" : "▶ play loop"}
        </button>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => { setPlaying(false); setStep(i); }}
              className={`px-2.5 py-1 rounded-full border ${step === i ? "bg-white text-black border-white" : "border-neutral-700 text-neutral-300"}`}
            >
              {["1 editor", "2 overlay", "3 test-me"][i]}
            </button>
          ))}
        </div>
        <button onClick={() => setTilt((v) => !v)} className="ml-auto px-3 py-1 rounded-full border border-neutral-700 text-neutral-300">
          3D tilt: {tilt ? "on" : "off"} — move mouse over stage
        </button>
      </div>

      <div ref={ref} onMouseMove={onMouse} className="relative h-[480px] overflow-hidden bg-[radial-gradient(ellipse_at_top,#141414_0%,#000_65%)]" style={{ perspective: 1400 }}>
        <motion.div
          className="absolute inset-0 grid place-items-center"
          animate={{ rotateX: tilt ? rx : 0, rotateY: tilt ? ry : 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* LAYER 1 — editor */}
          <motion.div
            animate={{ z: 0, y: step === 0 ? 34 : 60, scale: step === 0 ? 1 : 0.92, opacity: step === 0 ? 1 : 0.55 }}
            style={{ transformStyle: "preserve-3d", translateZ: 0 }}
            className="absolute w-[min(560px,86%)] rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl"
          >
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-neutral-800 text-[11px] text-neutral-500">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-700" /><span className="w-2.5 h-2.5 rounded-full bg-neutral-700" /><span className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
              <span className="ml-2 font-mono">cursor — payment-intent.ts</span>
              <span className="ml-auto text-[10px]">LAYER 1 · EDITOR</span>
            </div>
            <pre className="p-4 font-mono text-[12px] leading-relaxed text-neutral-300 whitespace-pre-wrap">{CODE}</pre>
            {step === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-4 mb-4 rounded-lg border border-white/40 bg-white/5 px-3 py-2 font-mono text-[11px]">
                <span className="bg-white text-black px-1.5 py-0.5 rounded text-[10px] font-bold">⌘U</span>
                <span className="ml-2 text-neutral-200">selection detected — press to explain →</span>
              </motion.div>
            )}
          </motion.div>

          {/* LAYER 2 — overlay */}
          <motion.div
            animate={{ z: 120, y: step === 1 ? 0 : -10, scale: step === 1 ? 1.02 : 0.96, opacity: step >= 1 ? 1 : 0 }}
            style={{ translateZ: 120 }}
            className="absolute w-[min(520px,82%)] rounded-xl border border-white/25 bg-black/95 shadow-[0_30px_80px_rgba(0,0,0,0.8)] backdrop-blur"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 text-[11px]">
              <span className="w-5 h-5 rounded-full bg-white text-black grid place-items-center text-[11px] font-bold">U</span>
              <span className="font-semibold text-[12px]">Unvibe overlay</span>
              <span className="ml-auto text-neutral-500 text-[10px]">LAYER 2 · STREAMING</span>
            </div>
            <div className="p-4 font-mono text-[12px] leading-relaxed text-neutral-200 min-h-[150px] whitespace-pre-wrap">
              {streamed}<span className="inline-block w-2 h-4 bg-white animate-pulse ml-0.5 align-middle" />
            </div>
            <div className="flex gap-1.5 px-4 pb-4">
              {["Beginner", "Intermediate", "Advanced"].map((l, i) => (
                <span key={l} className={`px-2 py-0.5 rounded-full border text-[10px] ${i === 1 ? "bg-white text-black border-white" : "border-neutral-700 text-neutral-400"}`}>{l}</span>
              ))}
            </div>
          </motion.div>

          {/* LAYER 3 — test me */}
          <AnimatePresence>
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, z: 160, y: -60, scale: 0.94 }}
                animate={{ opacity: 1, z: 240, y: -70, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.96 }}
                style={{ translateZ: 240 }}
                className="absolute w-[min(440px,78%)] rounded-xl border border-white bg-white text-black shadow-[0_40px_100px_rgba(255,255,255,0.15)] p-5"
              >
                <div className="text-[10px] tracking-[0.2em] text-neutral-500">LAYER 3 · TEST ME</div>
                <div className="font-bold text-lg mt-1">What does `amount: 2000` mean?</div>
                <div className="grid gap-1.5 mt-3 text-sm">
                  {["A · $2000.00", "B · $20.00 — minor units (cents)", "C · 2000 tokens"].map((o, i) => (
                    <motion.div key={o} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.18 }}
                      className={`px-3 py-2 rounded-lg border font-mono text-[12px] ${i === 1 ? "border-black bg-black text-white" : "border-neutral-300"}`}>
                      {o}{i === 1 ? "  ✓" : ""}
                    </motion.div>
                  ))}
                </div>
                <div className="text-[11px] text-neutral-500 mt-3">Press <kbd className="px-1 border border-neutral-300 rounded">B</kbd> to answer — saved to your learning record on this Mac.</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="absolute bottom-2 left-3 font-mono text-[10px] text-neutral-600">
          layers stack in Z: editor (z0) → overlay (z120) → quiz (z240) · auto-cycles every 4.2s
        </div>
      </div>
    </div>
  );
}
