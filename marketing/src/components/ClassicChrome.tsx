"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The pages on Design package-1106 (home, /pricing, /beta) draw their own header and footer (site/parts) and have no
 * floating Vibe or phone download bar (SPEC §3, §5). Every other page keeps the site-wide chrome this wraps.
 * usePathname is known on the server too, so the right chrome is in the first HTML (no swap after hydration).
 */
export const REDESIGNED_PATHS: readonly string[] = ["/", "/pricing", "/beta"];

export function ClassicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return REDESIGNED_PATHS.includes(pathname) ? null : <>{children}</>;
}
