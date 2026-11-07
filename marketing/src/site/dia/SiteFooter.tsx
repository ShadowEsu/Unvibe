"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { listingBadges, listingLinks, submittedTo } from "@/data/listings";
import { NewsletterSignup } from "@/components/paper/NewsletterSignup";
import { SupportMailLink } from "@/components/paper/SocialFollow";
import { openAnalyticsSettings } from "@/lib/analyticsConsent";
import { OFFICIAL_PROFILES } from "@/lib/contact";
import { trackDownloadPageClick } from "@/lib/downloadTracking";
import { D_ART_CREDITS, D_FOOT } from "./content";

/**
 * The footer on every page (plan mock 09): mono-caps columns with every link of the live footer (Security MUST-D6),
 * Analytics settings and the newsletter; then the quiet directory rows (Security 20261106-1849): "Listed on" holds the
 * live listings, each directory's own badge as a self-hosted copy (never hotlinked, never recoloured) and every live
 * listing as a plain text link; "Submitted to" holds, as plain text only, the pending directories that need a link back
 * before they approve. Server-rendered <a>s without nofollow, so the directories' checkers find them. Then the photo
 * and painting credits. The Follow column (Design, ledger 563) links the profiles Unvibe controls with rel="me", the
 * same list as the Organization JSON-LD sameAs.
 */
export function SiteFooter() {
  const pathname = usePathname();

  // /activate is a full-screen card over the page; a footer under it would only add hidden Tab stops.
  if (pathname?.startsWith("/activate")) return null;

  return (
    <footer className="d-foot">
      <div className="d-foot__cols">
        {D_FOOT.map((col) => (
          <FooterLinks key={col.h} heading={col.h} links={col.links}>
            {col.h === "Company" ? <li><button type="button" onClick={openAnalyticsSettings}>Analytics settings</button></li> : null}
          </FooterLinks>
        ))}
        <nav aria-label="Follow" className="d-foot__follow">
          <h2>Follow</h2>
          <ul>
            {OFFICIAL_PROFILES.map(([name, href]) => (
              <li key={href}><a href={href} target="_blank" rel="me noopener">{name}</a></li>
            ))}
          </ul>
        </nav>
        <div className="d-foot__news">
          {/* eslint-disable-next-line @next/next/no-img-element -- Vibe, our own mark */}
          <img className="d-foot__ghost" src="/brand/vibe.svg" width={48} height={48} alt="" />
          <p className="d-foot__newsh">Get the newsletter. One email when something ships.</p>
          <NewsletterSignup id="footer" />
          <SupportMailLink />
        </div>
      </div>
      <div className="d-foot__dirs">
        <p className="d-foot__dirs-h">Listed on</p>
        <div>
          <div className="d-foot__badges">
            {listingBadges.map((badge) => (
              <a key={badge.src} href={badge.href} target="_blank" rel="noopener" title={badge.alt}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a directory's badge as supplied, self-hosted */}
                <img src={badge.src} alt={badge.alt} width={badge.width} height={badge.height} loading="lazy" decoding="async" />
              </a>
            ))}
          </div>
          <p className="d-foot__links">
            {listingLinks.map((listing) => (
              <a key={listing.href} href={listing.href} target="_blank" rel="noopener">{listing.name}</a>
            ))}
            <Link href="/listed-on" className="d-foot__all">All listings <span aria-hidden="true">→</span></Link>
          </p>
        </div>
        {submittedTo.length ? (
          <>
            <p className="d-foot__dirs-h">Submitted to</p>
            <p className="d-foot__links">
              {submittedTo.map((site) => (
                <a key={site.href} href={site.href} target="_blank" rel="noopener">{site.name}</a>
              ))}
            </p>
          </>
        ) : null}
      </div>
      <div className="d-foot__base">
        <span>© {new Date().getFullYear()} Unvibe</span>
        <span>{D_ART_CREDITS}</span>
      </div>
    </footer>
  );
}

/** One footer column. The Download link counts as a footer click toward the download page. */
export function FooterLinks({ heading, links, children }: { heading: string; links: readonly (readonly [string, string])[]; children?: React.ReactNode }) {
  return (
    <nav aria-label={heading}>
      <h2>{heading}</h2>
      <ul>
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} onClick={href === "/beta" ? () => trackDownloadPageClick("footer") : undefined}>{label}</Link>
          </li>
        ))}
        {children}
      </ul>
    </nav>
  );
}
