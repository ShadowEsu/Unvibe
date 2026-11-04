/**
 * Google's deeplink to its source preferences tool, with unvibe.site filled in
 * (developers.google.com/search/docs/appearance/preferred-sources#deeplink). No Google script loads:
 * it's a plain link, and the badge is Google's official English light asset, served from unvibe.site.
 */
export const PREFERRED_SOURCE_HREF = "https://www.google.com/preferences/source?q=unvibe.site";
export const PREFERRED_SOURCE_BADGE = { src: "/badges/google-preferred-source-light.png", width: 676, height: 213 } as const;

export function PreferredSourceLink({ className }: { className?: string }) {
  return (
    <a href={PREFERRED_SOURCE_HREF} target="_blank" rel="noopener" className={className ? `paper-preferred-source ${className}` : "paper-preferred-source"}>
      <img src={PREFERRED_SOURCE_BADGE.src} alt="Add Unvibe as a preferred source on Google" width={PREFERRED_SOURCE_BADGE.width} height={PREFERRED_SOURCE_BADGE.height} loading="lazy" />
    </a>
  );
}
