import type { Viewport } from "next";
import type { ReactNode } from "react";
// The redesigned pages' look (Design package-1106): Motion's section kit (data-rise, data-reveal, data-tone), then
// site.css lays the parts out, home.css styles them, and Motion's moments and reveals animate them. Loaded here, it
// stays off every other page and out of the page files, which tests render.
import "@/motion/sections.css";
import "@/site/site.css";
import "@/site/home.css";
import "@/site/moments/moments.css";
import "@/site/moments/reveals.css";

/** The browser bar matches the pages' canvas (Design package-1106 §2). */
export const viewport: Viewport = { themeColor: "#fcfbf8" };

/** Home, /pricing and /beta (the route group adds nothing to their URLs). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
