import type { Metadata } from "next";
import { KIT_ASSETS, kitSections } from "@/lib/kit";
import { Vibe } from "@/components/paper/Vibe";

export const metadata: Metadata = {
  title: "Unvibe resource kit",
  description: "Facts, pitch, brand, logos, banners and templates for talking about Unvibe.",
  robots: { index: false, follow: false },
};

export default function KitPage() {
  const sections = kitSections();
  return (
    <main className="kit">
      <header className="kit__head">
        <div>
          <p className="pstats__eyebrow">Resource kit</p>
          <h1>Everything about Unvibe, <em>in one place.</em></h1>
          <p className="kit__lead">For people and AI agents writing to users or investors. Use only what is here.</p>
          <div className="kit__actions">
            <a className="kit__btn kit__btn--lime" href="/kit.md">Plain text for your AI</a>
            <a className="kit__btn" href="#assets">Logos and banners</a>
          </div>
        </div>
        <Vibe size={120} />
      </header>

      <nav className="kit__toc" aria-label="Sections">
        {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
        <a href="#assets">Assets</a>
      </nav>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="kit__card">
          <h2>{section.title}</h2>
          {section.intro ? <p>{section.intro}</p> : null}
          {section.bullets?.length ? <ul>{section.bullets.map((b) => <li key={b}>{b}</li>)}</ul> : null}
          {section.table ? (
            <div className="kit__table" role="table">
              <div role="row" className="kit__row kit__row--head">{section.table.head.map((h) => <span role="columnheader" key={h}>{h}</span>)}</div>
              {section.table.rows.map((row) => (
                <div role="row" className="kit__row" key={row[0]}>{row.map((cell, i) => <span role="cell" key={i}>{cell}</span>)}</div>
              ))}
            </div>
          ) : null}
          {section.code ? <pre className="kit__code">{section.code}</pre> : null}
        </section>
      ))}

      <section id="assets" className="kit__card">
        <h2>Assets</h2>
        <p>Click to open full size. Right click to save.</p>
        <div className="kit__assets">
          {KIT_ASSETS.map((asset) => (
            <a key={asset.path} className="kit__asset" href={asset.path} target="_blank" rel="noopener noreferrer">
              {asset.kind === "image" ? <img src={asset.path} alt={asset.name} loading="lazy" /> : <span className="kit__file">{asset.kind === "pdf" ? "PDF" : "VIDEO"}</span>}
              <strong>{asset.name}</strong>
              <small>{asset.use}</small>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
