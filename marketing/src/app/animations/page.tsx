import type { Metadata } from "next";
import { IslandDemo } from "@/components/animations/IslandDemo";
import { TerminalStack } from "@/components/animations/TerminalStack";

export const metadata: Metadata = {
  title: "Animation Lab · Unvibe",
  robots: { index: false, follow: false },
};

export default function AnimationsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-white">
      <p className="font-mono text-[11px] tracking-[0.25em] text-neutral-500">UNVIBE · ANIMATION LAB — localhost preview</p>
      <h1 className="text-4xl md:text-5xl font-bold mt-2">Island + multi-layer terminal.</h1>
      <p className="text-neutral-400 mt-3 max-w-2xl">
        Interactive proposals for the website and the desktop app. Play with pin positions,
        idle-dim physics, the ⌘U pulse, and the 3-layer Z-stack (editor → overlay → test-me).
        Nothing here ships to production until you approve it.
      </p>
      <div className="mt-4 flex gap-2 text-xs font-mono">
        <a href="http://localhost:3003/animations" className="px-3 py-1.5 rounded-full bg-white text-black">localhost:3003/animations</a>
        <span className="px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-400">github: local repo Unvibe/ (unvibe.site is live Next.js, no public repo — unvibe/unvibe on GitHub is an unrelated project)</span>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-1">01 — The Island</h2>
        <p className="text-sm text-neutral-500 mb-3">Quiet bar when you need it. Pin it, dim it, expand on hover or click-only. Mirrors <code>app/src/renderer/bar/bar.tsx</code>.</p>
        <IslandDemo />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-1">02 — Multi-layer terminal</h2>
        <p className="text-sm text-neutral-500 mb-3">One scene, three depths. Auto-loops; click a layer to freeze it. For the site: scroll-scrub it. For the app: real windows at different elevations.</p>
        <TerminalStack />
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-800 p-5 text-sm text-neutral-400">
        <h3 className="text-white font-semibold mb-2">How to reuse</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><b className="text-white">Website:</b> drop <code className="text-white">IslandDemo</code> into the “The Island” StoryStage beat; use <code className="text-white">TerminalStack</code> step states as scroll beats (step = scroll progress).</li>
          <li><b className="text-white">App:</b> Island physics (spring 380/26, idle 2.2s → 0.35 opacity) map 1:1 to the Electron floating bar; Z-values map to window levels.</li>
          <li>Motion respects <code className="text-white">prefers-reduced-motion</code> in production — add the guard from <code className="text-white">DecoderBoard</code> before shipping.</li>
        </ul>
      </section>
    </div>
  );
}
