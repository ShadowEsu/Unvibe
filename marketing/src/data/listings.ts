/**
 * Badge images are copies in public/badges, so a page view sends nothing to the directories. Tool
 * Index's verification badge has a copy too; its own hosted image (`remoteSrc`, toolindex.net) loads
 * only once this browser allowed analytics, the same answer the analytics code reads (Security R-2).
 */
export const listingBadges = [
  {
    name: "Smol Startup",
    href: "https://smolstartup.com/projects/unvibe",
    src: "/badges/smolstartup-top1-dark.svg",
    alt: "Smol Startup Top 1 Daily Winner",
    width: 195,
    height: 54,
  },
  {
    name: "Tool Index",
    href: "https://toolindex.net/tools/unvibe?ref=badge",
    src: "/badges/toolindex-unvibe-medium.svg",
    alt: "Unvibe listed on Tool Index",
    width: 180,
    height: 50,
  },
  {
    name: "Tool Index verify",
    href: "https://toolindex.net",
    src: "/badges/toolindex-verify.svg",
    remoteSrc: "https://toolindex.net/badge/verify/d8a3d4fa8bba7c93.svg",
    alt: "Verified by Tool Index",
    width: 165,
    height: 40,
  },
  {
    name: "DevRove",
    href: "https://devrove.com/tools/unvibe-site",
    src: "/badges/devrove-light.webp",
    alt: "Unvibe featured on DevRove",
    width: 156,
    height: 50,
  },
  {
    name: "AI Tool Discovery",
    href: "https://www.aitooldiscovery.com/tools/aih_unvibe",
    src: "/badges/aitooldiscovery-featured-1.webp",
    alt: "Featured on AI Tool Discovery",
    width: 200,
    height: 54,
  },
  {
    name: "LaunchBuff",
    href: "https://launchbuff.com/products/unvibe-8ayflt",
    src: "/badges/launchbuff-featured-dark.svg",
    alt: "Featured on LaunchBuff",
    width: 256,
    height: 80,
  },
] as const;

/** Live product listings, shown in the footer on every page. Origins are pinned by listings.test.ts. */
export const listingLinks = [
  { name: "Smol Startup #1", href: "https://smolstartup.com/projects/unvibe" },
  { name: "Product Hunt", href: "https://www.producthunt.com/products/unvibe?launch=unvibe" },
  { name: "LaunchKiwi", href: "https://launchkiwi.com/p/unvibe" },
  { name: "DevRove", href: "https://devrove.com/tools/unvibe-site" },
  { name: "AI Tool Discovery", href: "https://www.aitooldiscovery.com/tools/aih_unvibe" },
  { name: "VibeRank", href: "https://viberank.dev/apps/Unvibe" },
  { name: "SideProjectors", href: "https://www.sideprojectors.com/project/86739/unvibe" },
  { name: "LaunchBuff", href: "https://launchbuff.com/products/unvibe-8ayflt" },
  { name: "Tool Index", href: "https://toolindex.net/tools/unvibe?ref=badge" },
  { name: "TinyLaunch", href: "https://tinylaunch.com/launch/27829-unvibe" },
  { name: "Uneed", href: "https://www.uneed.best/tool/unvibe" },
  { name: "FounderMag", href: "https://foundermag.co/products/unvibe/" },
  { name: "KrispiTech product showcase", href: "https://krispitech.com/the-hidden-cost-of-vibe-coding-and-how-unvibe-helps-you-actually-own-your-codebase/" },
  { name: "vibecoding.app", href: "https://vibecoding.app/tools/unvibe" },
] as const;

/**
 * Backlinks these directories require before Unvibe's free listing can be submitted. Not shown
 * until the listing pages exist (Security R-4); then move each into listingLinks with its page URL.
 */
export const pendingBacklinks = [
  { name: "Startup Fame", href: "https://startupfa.me" },
  { name: "Fazier", href: "https://fazier.com" },
] as const;
