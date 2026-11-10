import type { Metadata } from "next";
import { listingBadges, listingLinks, submittedTo } from "@/data/listings";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/listed-on",
  title: "Where Unvibe Is Listed",
  absolute: true,
  description: "The directories and launch sites that list Unvibe, and the ones it is being submitted to.",
});

/**
 * Plain server-rendered links: the directories' checkers read this page's HTML, not a script. Each row shows the
 * listing's host under its name, so the page reads as a proof list: site, our listing link. Styles: site/dia/listed.css.
 */
export default function ListedOnPage() {
  return (
    <article className="lo-page">
      <div className="lo-head">
        <p className="lo-label">(Listed on)</p>
        <h1>Unvibe on directories and launch sites.</h1>
        <p className="lo-lead">Directories and launch sites with a page about Unvibe.</p>
      </div>
      <section className="lo-section" aria-labelledby="listings-title">
        <h2 id="listings-title">Listings</h2>
        <ul className="lo-badges">
          {listingBadges.map((badge) => (
            <li key={badge.name}>
              <a href={badge.href} target="_blank" rel="noopener">
                <img src={badge.src} alt={badge.alt} width={badge.width} height={badge.height} loading="lazy" decoding="async" />
              </a>
            </li>
          ))}
        </ul>
        <ul className="lo-grid">
          {listingLinks.map((listing) => (
            <li key={listing.href} className="lo-card">
              <a href={listing.href} target="_blank" rel="noopener noreferrer">{listing.name}</a>
              <span className="lo-domain">{new URL(listing.href).hostname.replace(/^www\./, "")}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="lo-section" aria-labelledby="submitted-title">
        <h2 id="submitted-title">Submitted to</h2>
        <p>Unvibe is being submitted to these directories. They ask for a link back while they review a listing.</p>
        <ul className="lo-submitted">
          {submittedTo.map((site) => (
            <li key={site.href}>
              <a href={site.href} target="_blank" rel="noopener">{site.name}</a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
