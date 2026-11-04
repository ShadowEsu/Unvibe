/**
 * BRANCH-ONLY (site/glass, ledger 443). The page backdrop, picked per page load with `?glass=a` or
 * `?glass=b`, so one production build can be shot with both for Design and Preston
 * (agents/design/unvibe-site-glass-redesign-2026-11-04.md §1). Once one is picked, this file, the query
 * and the other backdrop's rules in glass.css go.
 *
 * - a "Selected code": a fixed field of the demo's real debounce.ts with lime and sky selection bands.
 * - b "Brand shapes": hard-edged lime and sky discs on cream.
 */
export const GLASS_BACKDROPS = ["a", "b"] as const;
export type GlassBackdrop = (typeof GLASS_BACKDROPS)[number];

/** What a page shows with no `?glass=` (and what the server renders before the query is read). */
export const DEFAULT_GLASS_BACKDROP: GlassBackdrop = "a";

/** The backdrop a query string asks for; anything else gets the default. */
export function glassBackdropFrom(search: string): GlassBackdrop {
  return new URLSearchParams(search).get("glass") === "b" ? "b" : DEFAULT_GLASS_BACKDROP;
}
