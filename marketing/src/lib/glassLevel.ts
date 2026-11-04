/**
 * BRANCH-ONLY (site/glass, ledger 436). The Liquid Glass level, picked per page load with
 * `?glass=subtle` or `?glass=full`, so one production build can be shot at both levels for Design.
 * Design picks one level (spec agents/design/glass-spec-2026-11-04.md); then this file and the query
 * go, and the chosen level is hardcoded in glass.css.
 *
 * - subtle (L1): Glisse controls plus the floating layer (nav, sheets, dialogs, the Feedback tab, the
 *   mobile download bar).
 * - full (L2): subtle plus glass panels and cards, and Glisse `Input` for text fields.
 */
export const GLASS_LEVELS = ["subtle", "full"] as const;
export type GlassLevel = (typeof GLASS_LEVELS)[number];

/** What a page shows with no `?glass=` (and what the server renders before the query is read). */
export const DEFAULT_GLASS_LEVEL: GlassLevel = "full";

/** The level a query string asks for; anything else gets the default. */
export function glassLevelFrom(search: string): GlassLevel {
  const asked = new URLSearchParams(search).get("glass");
  return asked === "subtle" || asked === "full" ? asked : DEFAULT_GLASS_LEVEL;
}
