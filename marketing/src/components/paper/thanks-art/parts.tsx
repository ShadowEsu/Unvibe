import type { ReactNode } from "react";

/** The 2 px ink outline every scene draws with. */
export const INK = { stroke: "#141414", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** A flat sketch of one first-open moment. Decorative: the step caption carries the words. */
export function Scene({ children }: { children: ReactNode }) {
  return (
    <svg className="thanks-art" viewBox="0 0 240 180" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Our pointer, its tip at (x, y). `settle`: this scene's cue is the pointer settling onto its target. */
export function Pointer({ x, y, settle = false }: { x: number; y: number; settle?: boolean }) {
  return (
    <g className={settle ? "thanks-art__pointer thanks-art__pointer--settle" : "thanks-art__pointer"}>
      <path d={`M${x} ${y}l0 22 6-5 4 9 4-2-4-9 8 0z`} fill="#fff" {...INK} />
    </g>
  );
}

/** A button with the lime ring that says "press this". */
export function RingedButton({ x, y, width, label }: { x: number; y: number; width: number; label: string }) {
  return (
    <>
      <rect className="thanks-art__ring" x={x} y={y} width={width} height={26} rx={8} fill="none" stroke="#d6f45a" strokeWidth={6} />
      <rect x={x} y={y} width={width} height={26} rx={8} fill="#fff" {...INK} />
      <text className="thanks-art__label" x={x + width / 2} y={y + 17} textAnchor="middle">{label}</text>
    </>
  );
}
