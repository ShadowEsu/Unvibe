/**
 * The outage switch (BOSS 31 Oct): NEXT_PUBLIC_AI_MAINTENANCE=1 at build time, set together with the
 * API's AI_MAINTENANCE=1. The Try box says so up front and sends nothing, the hero drops its link to
 * the Try box, and the kit stops pointing people at it. Read once, here, for every surface.
 * A plain module (not the "use client" Try box) so server code like the kit gets the value itself.
 */
export const AI_MAINTENANCE = process.env.NEXT_PUBLIC_AI_MAINTENANCE?.trim() === "1";
