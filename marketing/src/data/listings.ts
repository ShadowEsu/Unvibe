/**
 * Every directory Unvibe is listed on or submitted to, in one list (source of truth: first100's BACKLINKS.json, Security
 * B5). A listing that goes live is one edit: set `status: "live"`, put our listing URL in `href`, and add its badge if
 * the site offers one.
 *
 * Security rules (requests/security/20261106-1849-footer-badges-wording.md):
 * - A badge only for a live listing. A pending site that requires a link gets plain text under "Submitted to", with no
 *   "Featured" or "Listed" words.
 * - No hotlinked images (B1): every badge is a copy in public/badges, so a page view sends nothing to the directories.
 * - Every badge file is recorded in public/badges/BADGES.md with its source URL, fetch date and sha256 (B2).
 * - Remove a pending site in the next site PR if it rejects Unvibe or has not listed it within 14 days.
 */
export type ListingStatus = "live" | "pending";

export interface ListingBadgeFile {
  /** Self-hosted copy in public/badges. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** The image's original URL. */
  source: string;
  /** YYYY-MM-DD the copy was fetched. */
  fetched: string;
  /** Where the badge links when the site asks for something other than the listing URL. */
  href?: string;
}

export interface Listing {
  site: string;
  status: ListingStatus;
  /** live: our listing URL. pending: the href the site's checker requires. */
  href: string;
  /** Shown only while live. Tool Index has two: its listing badge and its verification badge. */
  badges?: readonly ListingBadgeFile[];
  /** A pending site that requires a link back before approving. */
  linkRequired?: boolean;
  /** YYYY-MM-DD (UTC) we submitted Unvibe (first100's LISTINGS-500.md). "Submitted to" names a site only once this is set
   *  (Security MUST-D20: the line is true only once we submit; D21: the date is recorded). */
  submitted?: string;
}

export const LISTINGS: readonly Listing[] = [
  {
    site: "Smol Startup #1",
    status: "live",
    href: "https://smolstartup.com/projects/unvibe",
    badges: [
      {
        src: "/badges/smolstartup-top1-dark.svg",
        alt: "Smol Startup Top 1 Daily Winner",
        width: 195,
        height: 44,
        source: "https://smolstartup.com/smolstartup/images/badges/top1-dark.svg",
        fetched: "2026-10-28",
      },
    ],
  },
  { site: "Product Hunt", status: "live", href: "https://www.producthunt.com/products/unvibe?launch=unvibe" },
  { site: "LaunchKiwi", status: "live", href: "https://launchkiwi.com/p/unvibe" },
  {
    site: "DevRove",
    status: "live",
    href: "https://devrove.com/tools/unvibe-site",
    badges: [
      {
        src: "/badges/devrove-light.webp",
        alt: "Unvibe featured on DevRove",
        width: 156,
        height: 50,
        source: "https://devrove.com/light.svg",
        fetched: "2026-10-28",
      },
    ],
  },
  {
    site: "AI Tool Discovery",
    status: "live",
    href: "https://www.aitooldiscovery.com/tools/aih_unvibe",
    badges: [
      {
        src: "/badges/aitooldiscovery-featured-1.webp",
        alt: "Featured on AI Tool Discovery",
        width: 200,
        height: 54,
        source: "https://aitooldiscovery.com/badges/featured-1.svg",
        fetched: "2026-10-28",
      },
    ],
  },
  { site: "VibeRank", status: "live", href: "https://viberank.dev/apps/Unvibe" },
  { site: "SideProjectors", status: "live", href: "https://www.sideprojectors.com/project/86739/unvibe" },
  {
    site: "LaunchBuff",
    status: "live",
    href: "https://launchbuff.com/products/unvibe-8ayflt",
    badges: [
      {
        src: "/badges/launchbuff-featured-dark.svg",
        alt: "Featured on LaunchBuff",
        width: 256,
        height: 80,
        source: "https://launchbuff.com/badge-featured-dark.svg",
        fetched: "2026-10-28",
      },
    ],
  },
  {
    site: "Tool Index",
    status: "live",
    href: "https://toolindex.net/tools/unvibe?ref=badge",
    badges: [
      {
        src: "/badges/toolindex-unvibe-medium.svg",
        alt: "Unvibe listed on Tool Index",
        width: 180,
        height: 50,
        source: "https://toolindex.net/badge/unvibe/medium.svg",
        fetched: "2026-10-28",
      },
      {
        src: "/badges/toolindex-verify.svg",
        alt: "Verified by Tool Index",
        width: 165,
        height: 40,
        source: "https://toolindex.net/badge/verify/d8a3d4fa8bba7c93.svg",
        fetched: "2026-10-28",
        href: "https://toolindex.net",
      },
    ],
  },
  { site: "TinyLaunch", status: "live", href: "https://tinylaunch.com/launch/27829-unvibe" },
  { site: "Uneed", status: "live", href: "https://www.uneed.best/tool/unvibe" },
  {
    site: "vibecoding.app",
    status: "live",
    href: "https://vibecoding.app/tools/unvibe",
    badges: [
      {
        src: "/badges/vibecoding-listed-light.svg",
        alt: "Unvibe listed on vibecoding.app",
        width: 200,
        height: 54,
        source: "https://vibecoding.app/badges/tools/unvibe/listed-light.svg",
        fetched: "2026-11-06",
      },
    ],
  },
  { site: "ToolIndex on Replit", status: "live", href: "https://strategic-flow-audit.replit.app/directory/unvibe-185" },
  { site: "AgentWork", status: "live", href: "https://agentwork.tools/product/unvibe" },
  { site: "ComingUp", status: "live", href: "https://www.comingup.io/p/unvibe" },
  { site: "AIToolsCapital", status: "live", href: "https://aitoolscapital.com/tools/unvibe" },
  { site: "AISO Tools", status: "live", href: "https://aisotools.com/tool/unvibe" },
  { site: "AI ToolBoard", status: "live", href: "https://aitoolboard.com/tools/unvibe" },
  { site: "awesome-vibe-coding-resources (GitHub)", status: "live", href: "https://github.com/acvnace/awesome-vibe-coding-resources" },
  { site: "OpenUpvote", status: "live", href: "https://openupvote.com/project/unvibe" },
  { site: "JunkStartups", status: "live", href: "https://junkstartups.com/startups/unvibe" },
  { site: "ShowMySites", status: "live", href: "https://www.showmysites.com/unvibe/unvibe/" },
  { site: "The Hack Stack", status: "live", href: "https://thehackstack.com/s/unvibe/" },
  { site: "sideprojects.net", status: "live", href: "https://sideprojects.net/projects/unvibe" },
  { site: "Tiny Startups", status: "live", href: "https://www.tinystartups.com/startup/unvibe" },
  { site: "Indie Hackers", status: "live", href: "https://www.indiehackers.com/product/unvibe" },
  { site: "DevHunt", status: "live", href: "https://devhunt.org/tool/unvibe" },
  { site: "Daniel Launches", status: "pending", href: "https://daniellaunches.com", linkRequired: true },
  // Approved 12 Nov 04:39Z (first100, LIVE-LISTINGS); the listing links unvibe.site, so the href keeps its utm_source for their checker.
  { site: "Startup Fame", status: "live", href: "https://startupfa.me/s/unvibe?utm_source=unvibe.site" },
  { site: "DodoDirectory", status: "pending", href: "https://dododirectory.com", linkRequired: true, submitted: "2026-11-07" },
  { site: "SumoDir", status: "pending", href: "https://sumodir.com", linkRequired: true, submitted: "2026-11-07" },
  { site: "Postmake", status: "pending", href: "https://postmake.io/submit", linkRequired: true, submitted: "2026-11-07" },
  { site: "Nick Launches", status: "pending", href: "https://nicklaunches.com/", linkRequired: true },
  {
    site: "AI Tools Prime",
    status: "pending",
    href: "https://www.aitoolsprime.com?utm_source=badge&utm_medium=referral&utm_campaign=featured_badge",
    linkRequired: true,
    submitted: "2026-11-07",
  },
  { site: "Dang.ai", status: "pending", href: "https://dang.ai", linkRequired: true, submitted: "2026-11-06" },
  { site: "ToolPilot", status: "pending", href: "https://www.toolpilot.ai", linkRequired: true, submitted: "2026-11-06" },
  { site: "Awesome Tools", status: "pending", href: "https://awesome.tools", linkRequired: true, submitted: "2026-11-06" },
];

/** Badges of live listings, shown in the footer on every page and on /listed-on. */
export const listingBadges = LISTINGS.flatMap(({ site, status, href, badges = [] }) =>
  status === "live"
    ? badges.map((badge, index) => ({
        name: index === 0 ? site : `${site} ${index + 1}`,
        href: badge.href ?? href,
        src: badge.src,
        alt: badge.alt,
        width: badge.width,
        height: badge.height,
      }))
    : [],
);

/** Live product listings, shown in the footer on every page. Origins are pinned by listings.test.ts. */
export const listingLinks = LISTINGS.filter(({ status }) => status === "live").map(({ site, href }) => ({ name: site, href }));

/** Pending sites we have submitted to that require a link back while they review a listing: plain text under
 *  "Submitted to". A site we haven't submitted to yet (no date) isn't named. */
export const submittedTo = LISTINGS.filter(({ status, linkRequired, submitted }) => status === "pending" && linkRequired && submitted).map(
  ({ site, href }) => ({ name: site, href }),
);
