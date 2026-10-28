"use client";

import { useEffect, useRef, useState } from "react";
import { listingBadges, listingLinks } from "@/data/listings";

type Badge = (typeof listingBadges)[number];

/**
 * Directory badges are hot-linked from the directories. When one fails to load (the host is down
 * or blocked), drop it instead of showing a broken image with clipped alt text; the text links
 * below still list every directory.
 */
function ListingBadge({ badge }: { badge: Badge }) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // An image can fail before hydration attaches onError; decode() rejects for a broken image.
    const img = image.current;
    if (img?.complete) img.decode().catch(() => setFailed(true));
  }, []);
  if (failed) return null;
  return (
    <a href={badge.href} target="_blank" rel="noopener noreferrer" title={badge.alt} aria-label={badge.alt}>
      <img ref={image} src={badge.src} alt={badge.alt} width={badge.width} height={badge.height} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </a>
  );
}

export function ListingBadges() {
  return (
    <div className="paper-listings">
      {/* Not "Listed on": Startup Fame and Fazier are backlinks required before those listings are submitted. */}
      <p className="paper-meta">Find Unvibe</p>
      <div className="paper-listings__badges">
        {listingBadges.map((badge) => <ListingBadge key={badge.src} badge={badge} />)}
      </div>
      <div className="paper-listings__links">
        {listingLinks.map((listing) => (
          <a
            key={listing.href}
            href={listing.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {listing.name}
          </a>
        ))}
      </div>
    </div>
  );
}
