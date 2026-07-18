import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowUpRight, Download, FileText, Mail, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Angel Investor Page',
  description: 'Investor materials and contact information for Unvibe.',
};

const materials = [
  {
    eyebrow: 'SHORT DECK',
    title: 'Investor pitch deck',
    description: 'A concise seven-page introduction to Unvibe, the problem, product, and opportunity.',
    href: '/investors/unvibe-investor-deck-short.pdf',
    label: 'Open short deck',
  },
  {
    eyebrow: 'FULL DECK',
    title: 'Full investor pitch deck',
    description: 'The longer version for investors who want the fuller product and business context.',
    href: '/investors/unvibe-investor-deck-full.pdf',
    label: 'Open full deck',
  },
];

export default function InvestorsPage() {
  return (
    <main className="min-h-screen bg-[#171323] text-[#f7f4ff]">
      <section className="relative overflow-hidden border-b border-[#8e75b8]/35 px-6 py-20 sm:px-10 sm:py-28">
        <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
          <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#8e63f5]/20 blur-3xl" />
          <div className="absolute right-0 top-0 h-px w-[65%] bg-[#bda4ff]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <p className="mb-8 flex items-center gap-2 font-mono text-xs font-bold tracking-[0.2em] text-[#bda4ff]"><Sparkles size={15} /> UNVIBE / INVESTORS</p>
          <div className="grid gap-12 lg:grid-cols-[1.35fr_.65fr] lg:items-end">
            <div>
              <p className="mb-5 font-mono text-xs font-bold tracking-[0.18em] text-[#a886ff]">ANGEL INVESTOR PAGE</p>
              <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[.96] tracking-[-0.065em] sm:text-7xl lg:text-8xl">
                Let&apos;s make AI-written code <span className="font-serif font-normal italic text-[#a886ff]">understandable.</span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[#c2b9d2] sm:text-xl">
                Unvibe is building the desktop learning layer for people who build with AI. We are open to conversations with angels and early-stage investors who believe people should understand the software they ship.
              </p>
            </div>
            <aside className="border-l border-[#8e75b8]/50 pl-6 sm:pl-8">
              <p className="font-mono text-xs font-bold tracking-[0.16em] text-[#a886ff]">FOUNDER CONTACT</p>
              <a className="mt-4 block text-lg font-medium text-white underline decoration-[#8e63f5] decoration-2 underline-offset-4 hover:text-[#cdbbff]" href="mailto:prestonjaysusanto@gmail.com">prestonjaysusanto@gmail.com</a>
              <a className="mt-3 block text-lg font-medium text-white underline decoration-[#8e63f5] decoration-2 underline-offset-4 hover:text-[#cdbbff]" href="mailto:preston@unvibe.site">preston@unvibe.site</a>
              <p className="mt-6 text-sm leading-relaxed text-[#a99caf]">Open to angel investors, early-stage funds, and thoughtful operators.</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-bold tracking-[0.16em] text-[#a886ff]">INVESTOR MATERIALS</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Start with the version that fits your time.</h2>
            </div>
            <a href="mailto:preston@unvibe.site?subject=Unvibe%20investment%20conversation" className="inline-flex items-center gap-2 text-sm font-semibold text-[#cdbbff] hover:text-white"><Mail size={16} /> Start a conversation <ArrowUpRight size={15} /></a>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {materials.map((material) => (
              <article key={material.href} className="flex min-h-72 flex-col border border-[#8e75b8]/60 bg-[#201a2e] p-7 shadow-[8px_8px_0_#7954bb] transition-transform hover:-translate-y-1 sm:p-9">
                <p className="font-mono text-xs font-bold tracking-[0.16em] text-[#a886ff]">{material.eyebrow}</p>
                <FileText className="mt-10 text-[#bca1ff]" size={34} strokeWidth={1.4} />
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">{material.title}</h3>
                <p className="mt-3 max-w-md leading-relaxed text-[#bcb3ca]">{material.description}</p>
                <a href={material.href} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-2 pt-9 font-semibold text-[#cdbbff] hover:text-white">{material.label} <Download size={17} /></a>
              </article>
            ))}
          </div>

          <article className="mt-8 grid overflow-hidden border border-[#8e75b8]/60 bg-[#201a2e] lg:grid-cols-[.74fr_1.26fr]">
            <div className="p-7 sm:p-10">
              <p className="font-mono text-xs font-bold tracking-[0.16em] text-[#a886ff]">ONE-PAGER</p>
              <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">The fast overview.</h3>
              <p className="mt-4 leading-relaxed text-[#bcb3ca]">A single-page summary of the company, product, market need, audience, business model, and current status.</p>
              <a href="/investors/unvibe-investor-one-pager.png" target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 font-semibold text-[#cdbbff] hover:text-white">Open one-pager <Download size={17} /></a>
            </div>
            <a href="/investors/unvibe-investor-one-pager.png" target="_blank" rel="noreferrer" className="block bg-white p-3 sm:p-5" aria-label="Open the Unvibe investor one-pager">
              <Image src="/investors/unvibe-investor-one-pager.png" alt="Unvibe investor one-pager" width={1103} height={1426} className="mx-auto h-auto max-h-[650px] w-auto max-w-full shadow-xl" />
            </a>
          </article>
        </div>
      </section>
    </main>
  );
}
