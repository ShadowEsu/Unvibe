/** The id Glisse checks before it adds its own <style> (glisse 0.5.0 dist/index.js insertStyles). */
export const GLISSE_STYLES_ID = "glisse-styles";

/**
 * Security condition (requests/security/20261104-0359-glisse-0.5.0-dependency-review.md, finding 1):
 * Glisse's CSS ships as the bundled "glisse/styles.css" (app/layout.tsx), a 'self' stylesheet. At import
 * time Glisse would also prepend an un-nonced inline <style> unless an element with this id already
 * exists, so this marker is server-rendered in <head>, before any Glisse code runs. Re-check that
 * early return on every Glisse version bump.
 */
export function GlisseStylesMarker() {
  return <meta id={GLISSE_STYLES_ID} name="glisse-styles" content="bundled" />;
}
