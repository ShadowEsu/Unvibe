import type { Metadata } from "next";
import { directoryLinks, listingLinks } from "@/data/listings";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/listed-on",
  title: "Where Unvibe Is Listed",
  absolute: true,
  description: "The directories and launch sites that list Unvibe, and the ones it is being submitted to.",
});

/** Plain server-rendered links: the directories' checkers read this page's HTML, not a script. */
export default function ListedOnPage() {
  return (
    <article className="fos-page listed-on">
      <header className="fos-page__head">
        <div>
          <p className="pstats__eyebrow">Listed on</p>
          <h1>Unvibe on directories and launch sites.</h1>
          <p className="fos-page__lead">Directories and launch sites with a page about Unvibe.</p>
        </div>
      </header>
      <section aria-labelledby="listings-title">
        <h2 id="listings-title">Listings</h2>
        <ul className="listed-on__list">
          {listingLinks.map((listing) => (
            <li key={listing.href}>
              <a href={listing.href} target="_blank" rel="noopener noreferrer">{listing.name}</a>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="directories-title">
        <h2 id="directories-title">Other directories</h2>
        <p>Unvibe is being submitted to these directories. They ask for a link back while they review a listing.</p>
        <ul className="listed-on__list">
          {directoryLinks.map((directory) => (
            <li key={directory.href}>
              <a href={directory.href} target="_blank" rel="noopener">
                {"logo" in directory ? (
                  <img src={directory.logo.src} alt={directory.name} width={directory.logo.width} height={directory.logo.height} loading="lazy" />
                ) : (
                  directory.name
                )}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
