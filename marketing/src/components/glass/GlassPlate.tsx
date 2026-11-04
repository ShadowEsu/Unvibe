import { Glass } from "glisse";

/**
 * Glisse glass behind a surface's own content: put it first inside the surface. The surface keeps its
 * element, landmark and children; the plate is decoration (aria-hidden, no clicks). Whether a plate
 * shows, and at which level, is decided by the surface lists in app/glass.css, so moving a surface
 * between levels is a CSS change. With no listing the plate is hidden and the surface looks as before.
 */
export function GlassPlate() {
  return <Glass className="glass-plate" aria-hidden="true" />;
}
