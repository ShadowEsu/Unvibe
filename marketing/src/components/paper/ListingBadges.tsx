"use client";

import { useEffect, useRef, useState } from "react";
import { listingBadges, listingLinks } from "@/data/listings";
import { ANALYTICS_CONSENT_CHANGED } from "@/lib/analyticsConsent";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";

type Badge = (typeof listingBadges)[number];

/**
 * Badges are served from unvibe.site. A badge with a `remoteSrc` switches to the directory's own
 * image only when `remote` is true (this browser allowed analytics); if that image fails, the local
 * copy shows again. When the local copy fails too, the badge is dropped instead of showing a broken
 * image with clipped alt text; the text links below still list every directory.
 */
function ListingBadge({ badge, remote }: { badge: Badge; remote: boolean }) {
  const [failed, setFailed] = useState<readonly string[]>([]);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // An image can fail before hydration attaches onError; decode() rejects for a broken image.
    const img = image.current;
    if (img?.complete) img.decode().catch(() => setFailed((list) => [...list, badge.src]));
  }, [badge.src]);
  const remoteSrc = remote && "remoteSrc" in badge ? badge.remoteSrc : undefined;
  const src = remoteSrc && !failed.includes(remoteSrc) ? remoteSrc : badge.src;
  if (failed.includes(badge.src)) return null;
  return (
    <a href={badge.href} target="_blank" rel="noopener noreferrer" title={badge.alt} aria-label={badge.alt}>
      <img ref={image} src={src} alt={badge.alt} width={badge.width} height={badge.height} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed((list) => [...list, src])} />
    </a>
  );
}

export function ListingBadges() {
  // Off-site badge images wait for the same answer the analytics code reads (Allow, no opt-out).
  const [remote, setRemote] = useState(false);
  useEffect(() => {
    const sync = () => setRemote(!browserTrackingDisabled());
    sync();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED, sync);
    return () => window.removeEventListener(ANALYTICS_CONSENT_CHANGED, sync);
  }, []);

  return (
    <div className="paper-listings">
      <p className="paper-meta">Find Unvibe</p>
      <div className="paper-listings__badges">
        {listingBadges.map((badge) => <ListingBadge key={badge.name} badge={badge} remote={remote} />)}
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
