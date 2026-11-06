"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The pages on Design package-1106 (home, /pricing, /beta) draw their own header, <main> and footer (site/parts) and
 * have no floating Vibe or phone download bar (SPEC §3, §5). Every other page keeps the site-wide chrome these wrap.
 * usePathname is known on the server too, so the right chrome is in the first HTML (no swap after hydration).
 */
const REDESIGNED_PATHS: readonly string[] = ["/", "/pricing", "/beta", "/lab/d", "/lab/d/pricing", "/lab/d/download"];

function useRedesigned(): boolean {
  return REDESIGNED_PATHS.includes(usePathname());
}

/** The site-wide nav, footer, phone bar and floating Vibe: not on the redesigned pages. */
export function ClassicChrome({ children }: { children: ReactNode }) {
  return useRedesigned() ? null : <>{children}</>;
}

/**
 * The skip link's target. The redesigned pages render their own <main> between their header and footer, so those
 * stay landmarks of their own and "Skip to content" skips the header.
 */
export function MainLandmark({ children }: { children: ReactNode }) {
  return useRedesigned() ? <>{children}</> : <main id="main" tabIndex={-1}>{children}</main>;
}
