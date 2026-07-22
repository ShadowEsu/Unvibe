import type { Metadata } from 'next';
import { ArrowUpRight, Download, FileText, Mail, ShieldCheck, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Unvibe for Investors',
  description: 'Unvibe investor deck, Mac tester build, and founder contact.',
};

const CONFIGURED_DMG_URL = process.env.NEXT_PUBLIC_INVESTOR_DMG_URL?.trim()
  || 'https://kgtnwm7mfrhop6vj.public.blob.vercel-storage.com/investors/Unvibe-0.1.0-arm64-unsigned.dmg';
const DMG_URL = `${CONFIGURED_DMG_URL}${CONFIGURED_DMG_URL.includes('?') ? '&' : '?'}v=20260721-final`;

const DECK_URL = '/investors/unvibe-pitch-deck.pdf';

export default function InvestorsPage() {
  return (
    <main className="min-h-screen bg-[#171323] text-[#f7f4ff]">
      <nav className="border-b border-[#8e75b8]/35 bg-[#120e1c] px-6 py-4 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <a href="/" className="font-mono text-xs font-bold uppercase tracking-[.14em] text-[#cdbbff] hover:text-white">← Unvibe</a>
          <a href={DECK_URL} target="_blank" rel="noreferrer" className="font-mono text-xs font-bold uppercase tracking-[.12em] text-[#a886ff] hover:text-white">Investor deck ↗</a>
        </div>
      </nav>

      <section className="relative overflow-hidden px-6 py-20 sm:px-10 sm:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
          <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-[#8e63f5]/20 blur-3xl" />
          <div className="absolute right-0 top-12 h-px w-2/5 bg-[#bda4ff]" />
        </div>
        <div className="relative mx-auto max-w-5xl">
          <p className="flex items-center gap-2 font-mono text-xs font-bold tracking-[.2em] text-[#bda4ff]"><Sparkles size={15} /> UNVIBE / INVESTORS</p>
          <div className="mt-8 grid gap-12 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              <p className="font-mono text-xs font-bold tracking-[.16em] text-[#a886ff]">PRIVATE BETA · MAC-FIRST</p>
              <h1 className="mt-5 max-w-3xl text-balance text-5xl font-semibold leading-[.94] tracking-[-.065em] sm:text-7xl">
                AI writes the code. <span className="font-serif font-normal italic text-[#a886ff]">Unvibe makes it yours.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#c2b9d2]">
                A desktop learning layer for understanding AI-generated code in context — before it becomes something you cannot explain, debug, or maintain.
              </p>
            </div>
            <div className="border-l border-[#8e75b8]/50 pl-6 sm:pl-8">
              <p className="font-mono text-xs font-bold tracking-[.16em] text-[#a886ff]">FOUNDER</p>
              <p className="mt-3 text-2xl font-semibold tracking-[-.04em]">Preston Susanto</p>
              <a href="mailto:prestonjaysusanto@gmail.com" className="mt-5 block text-sm text-[#cdbbff] underline decoration-[#8e63f5] underline-offset-4 hover:text-white">prestonjaysusanto@gmail.com</a>
              <a href="mailto:preston@unvibe.site" className="mt-3 block text-sm text-[#cdbbff] underline decoration-[#8e63f5] underline-offset-4 hover:text-white">preston@unvibe.site</a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#8e75b8]/35 bg-[#120e1c] px-6 py-12 sm:px-10">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          <a href={DECK_URL} target="_blank" rel="noreferrer" className="group border border-[#8e75b8]/60 bg-[#201a2e] p-7 shadow-[7px_7px_0_#5a3a9a] transition-transform hover:-translate-y-1">
            <FileText className="text-[#bca1ff]" size={30} strokeWidth={1.5} />
            <p className="mt-6 font-mono text-xs font-bold tracking-[.16em] text-[#a886ff]">14-SLIDE DECK</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-.04em]">Investor pitch deck</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#bcb3ca]">Problem, product, market, model, and fundraise context.</p>
            <span className="mt-7 inline-flex items-center gap-2 font-semibold text-[#cdbbff] group-hover:text-white">Open deck <ArrowUpRight size={17} /></span>
          </a>

          <a href={DMG_URL} className="group border border-[#a886ff] bg-[#8e63f5] p-7 shadow-[7px_7px_0_#4d3184] transition-transform hover:-translate-y-1">
            <Download className="text-white" size={30} strokeWidth={1.5} />
            <p className="mt-6 font-mono text-xs font-bold tracking-[.16em] text-[#e4dbff]">TESTER BUILD</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-.04em]">Download the Mac app</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#eeeaff]">Apple Silicon DMG. Drag Unvibe to Applications, then test it with your own code.</p>
            <span className="mt-7 inline-flex items-center gap-2 font-semibold text-white">Download DMG <Download size={17} /></span>
          </a>
        </div>
      </section>

      <section className="px-6 py-14 sm:px-10 sm:py-18">
        <div className="mx-auto grid max-w-5xl gap-8 border border-[#8e75b8]/45 bg-[#201a2e]/60 p-7 sm:grid-cols-[1fr_auto] sm:items-center sm:p-9">
          <div>
            <p className="flex items-center gap-2 font-mono text-xs font-bold tracking-[.16em] text-[#a886ff]"><ShieldCheck size={16} /> PRIVATE-BETA NOTE</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#c2b9d2]">The tester DMG is unsigned and requires macOS&apos;s normal first-open approval. Accessibility is optional and only needed for the global ⌘U selection shortcut. No AI provider key is included in the app.</p>
          </div>
          <a href="mailto:preston@unvibe.site?subject=Unvibe%20investment%20conversation" className="inline-flex items-center justify-center gap-2 border border-[#8e75b8]/65 px-5 py-3 text-sm font-semibold text-[#cdbbff] hover:border-[#cdbbff] hover:text-white"><Mail size={16} /> Contact founder</a>
        </div>
      </section>
    </main>
  );
}
