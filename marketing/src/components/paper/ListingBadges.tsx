import { listingBadges, listingLinks } from "@/data/listings";

export function ListingBadges() {
  return (
    <div className="paper-listings">
      <p className="paper-meta">Listed on</p>
      <div className="paper-listings__badges">
        {listingBadges.map((badge) => (
          <a
            key={badge.src}
            href={badge.href}
            target="_blank"
            rel="noopener noreferrer"
            title={badge.alt}
            aria-label={badge.alt}
          >
            <img
              src={badge.src}
              alt={badge.alt}
              width={badge.width}
              height={badge.height}
            />
          </a>
        ))}
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
